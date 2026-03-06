#!/usr/bin/env python3
"""
FastAPI server for Block Phrase Builder.
Run with: uvicorn server:app --reload --port 8000
"""
from __future__ import annotations

import os
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from main import BlockPhraseBuilder

# ── Limits ─────────────────────────────────────────────────────────────────────
MAX_BLOCKS = 30           # max blocks accepted in a request
MAX_LETTERS_PER_BLOCK = 6
MAX_PHRASE_LEN = 200
MAX_WORD_LEN = 50

TIMEOUT_CHECK = 10        # seconds — phrase checking
TIMEOUT_WORDS = 60 * 5        # seconds — word finding (cached after first call)
TIMEOUT_PHRASES = 90  * 5    # seconds — phrase finding (very heavy)
TIMEOUT_BUILDER = 60  * 5    # seconds — interactive builder ops

# ── App ────────────────────────────────────────────────────────────────────────
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"])
app = FastAPI(title="Cabin Blocks API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://localhost:4201"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Thread pool for offloading CPU-heavy work (timeout enforced via future.result)
# Note: Python threads cannot be force-killed; timeout only prevents blocking the
# response — the thread will finish naturally in the background.
_executor = ThreadPoolExecutor(max_workers=4)

# Load block data once at startup
_blocks_file = os.path.join(os.path.dirname(__file__), "blocks.txt")
builder = BlockPhraseBuilder(_blocks_file)

# Cache of custom builders keyed by frozenset of block strings, so find_possible_words
# results are cached across requests for the same block set.
_builder_cache: dict[tuple, BlockPhraseBuilder] = {}


# ── Helpers ────────────────────────────────────────────────────────────────────
def run_with_timeout(fn, timeout: int):
    """Submit fn to the thread pool and wait up to timeout seconds."""
    future = _executor.submit(fn)
    try:
        return future.result(timeout=timeout)
    except FuturesTimeoutError:
        raise HTTPException(
            status_code=408,
            detail=f"Computation timed out after {timeout}s. Try a shorter phrase or fewer blocks.",
        )


def validate_blocks(blocks: list[str]) -> list[str]:
    """Validate and normalise a list of block strings from a request."""
    if len(blocks) > MAX_BLOCKS:
        raise HTTPException(status_code=422, detail=f"Too many blocks (max {MAX_BLOCKS}).")
    result = []
    for b in blocks:
        b = b.strip().lower()
        if not b or not b.isalpha():
            raise HTTPException(status_code=422, detail=f"Invalid block '{b}': must contain only letters.")
        if len(b) > MAX_LETTERS_PER_BLOCK:
            raise HTTPException(status_code=422, detail=f"Block '{b}' is too long (max {MAX_LETTERS_PER_BLOCK} letters).")
        result.append(b)
    return result


def _can_form_word(word: str, combo: list[str]) -> bool:
    """Backtracking check: can the letters of word be covered by combo (one block per letter)?"""
    letters = list(word.lower())
    available = [{"letters": b, "used": False} for b in combo]

    def bt(i: int) -> bool:
        if i == len(letters):
            return True
        for b in available:
            if not b["used"] and letters[i] in b["letters"]:
                b["used"] = True
                if bt(i + 1):
                    return True
                b["used"] = False
        return False

    return bt(0)


def match_word_to_blocks(word: str, blocks: list[str]) -> tuple[bool, list[str]]:
    """
    Find the minimal block assignment for word that maximises letters remaining
    (preserving the most options for future words).
    Returns (can_form, list_of_block_strings_used).
    """
    from itertools import combinations as _combos
    n = len(word)
    for size in range(n, len(blocks) + 1):
        best_used: Optional[List[str]] = None
        best_score = -1
        for combo_indices in _combos(range(len(blocks)), size):
            combo = [blocks[i] for i in combo_indices]
            if _can_form_word(word, combo):
                remaining_letters = sum(
                    len(blocks[i]) for i in range(len(blocks)) if i not in combo_indices
                )
                if remaining_letters > best_score:
                    best_score = remaining_letters
                    best_used = combo
        if best_used is not None:
            return True, best_used
    return False, []


def format_word_results(results: dict) -> list[dict]:
    return [
        {"word": item["word"], "blocks": item["blocks"], "numBlocks": item["num_blocks"]}
        for items in results.values()
        for item in items
    ]


# ── Request models ─────────────────────────────────────────────────────────────
class PhraseCheckRequest(BaseModel):
    phrase: str = Field(..., max_length=MAX_PHRASE_LEN)


class BuilderWordsRequest(BaseModel):
    all_blocks: List[str] = Field(default_factory=list)
    chosen_words: List[str] = Field(default_factory=list)
    common_only: bool = True


class BuilderCheckRequest(BaseModel):
    word: str = Field(..., max_length=MAX_WORD_LEN)
    all_blocks: List[str] = Field(default_factory=list)
    chosen_words: List[str] = Field(default_factory=list)


# ── Endpoints ──────────────────────────────────────────────────────────────────
@app.get("/blocks")
@limiter.limit("60/minute")
def get_blocks(request: Request):
    return {
        "blocks": [{"letters": b} for b in builder.blocks],
        "totalLetters": sum(len(b) for b in builder.blocks),
    }


@app.post("/check")
@limiter.limit("30/minute")
def check_phrase(body: PhraseCheckRequest, request: Request):
    phrase = body.phrase.strip()
    if not phrase:
        raise HTTPException(status_code=422, detail="Phrase cannot be empty.")

    def _run():
        found, blocks_used, _ = builder.can_form_phrase(phrase)
        phrase_letters = Counter(phrase.replace(" ", "").lower())
        missing = {} if found else builder._compute_missing_letters(phrase_letters)
        return {
            "phrase": phrase,
            "canForm": found,
            "blocksUsed": blocks_used,
            "missingLetters": missing,
        }

    return run_with_timeout(_run, TIMEOUT_CHECK)


@app.get("/words")
@limiter.limit("5/minute")
def find_words(request: Request, common_only: bool = True):
    def _run():
        results = builder.find_possible_words(common_only=common_only)
        return format_word_results(results)

    words = run_with_timeout(_run, TIMEOUT_WORDS)
    # Group by numBlocks to match WordsByBlockCount shape
    grouped: dict[int, list] = {}
    for w in words:
        grouped.setdefault(w["numBlocks"], []).append(w)
    return grouped


@app.get("/phrases")
@limiter.limit("2/minute")
def find_phrases(request: Request):
    def _run():
        return builder.find_multiword_phrases(max_words=3, common_only=True)

    return run_with_timeout(_run, TIMEOUT_PHRASES)


def _get_builder(blocks: list[str]) -> BlockPhraseBuilder:
    """Return a cached builder for the given block set, creating one if needed."""
    key = tuple(sorted(blocks))
    if key not in _builder_cache:
        _builder_cache[key] = BlockPhraseBuilder.from_blocks(blocks)
    return _builder_cache[key]


@app.post("/builder/words")
@limiter.limit("20/minute")
def builder_words(body: BuilderWordsRequest, request: Request):
    all_blocks = validate_blocks(body.all_blocks)
    chosen = [w.strip().lower() for w in body.chosen_words if w.strip()]
    context_phrase = ' '.join(chosen)
    custom_builder = _get_builder(all_blocks)

    def _run():
        results = custom_builder.find_words_for_context(context_phrase, common_only=body.common_only)
        return {"availableWords": format_word_results(results)}

    return run_with_timeout(_run, TIMEOUT_BUILDER)


@app.post("/builder/check")
@limiter.limit("60/minute")
def builder_check(body: BuilderCheckRequest, request: Request):
    word = body.word.strip().lower()
    if not word or not word.replace(" ", "").isalpha():
        raise HTTPException(status_code=422, detail="Word must contain only letters.")

    all_blocks = validate_blocks(body.all_blocks)
    chosen = [w.strip().lower() for w in body.chosen_words if w.strip()]
    custom_builder = _get_builder(all_blocks)

    def _run():
        combined = ' '.join(chosen + [word])
        can_form, _, _ = custom_builder.can_form_phrase(combined)
        return {"canForm": can_form, "blocksUsed": []}

    return run_with_timeout(_run, TIMEOUT_BUILDER)
