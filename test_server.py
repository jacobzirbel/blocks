"""Tests for the FastAPI server endpoints."""
import pytest
from fastapi.testclient import TestClient

from server import app, validate_blocks, format_word_results, _builder_cache


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture(autouse=True)
def clear_builder_cache():
    _builder_cache.clear()
    yield
    _builder_cache.clear()


# ── validate_blocks ───────────────────────────────────────────────────────────

class TestValidateBlocks:
    def test_valid_blocks(self):
        result = validate_blocks(["ab", "CD", " ef "])
        assert result == ["ab", "cd", "ef"]

    def test_too_many_blocks(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            validate_blocks(["a"] * 31)
        assert exc.value.status_code == 422

    def test_non_alpha_block(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException):
            validate_blocks(["a1b"])

    def test_empty_block(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException):
            validate_blocks(["ab", "", "cd"])

    def test_block_too_long(self):
        from fastapi import HTTPException
        with pytest.raises(HTTPException):
            validate_blocks(["abcdefg"])  # 7 chars, max is 6


# ── format_word_results ───────────────────────────────────────────────────────

class TestFormatWordResults:
    def test_flattens_results(self):
        results = {
            2: [{"word": "ab", "blocks": ["a", "b"], "num_blocks": 2}],
            3: [{"word": "abc", "blocks": ["a", "b", "c"], "num_blocks": 3}],
        }
        formatted = format_word_results(results)
        assert len(formatted) == 2
        assert formatted[0]["numBlocks"] == 2
        assert formatted[1]["numBlocks"] == 3

    def test_empty_results(self):
        assert format_word_results({}) == []


# ── GET /blocks ───────────────────────────────────────────────────────────────

class TestGetBlocks:
    def test_returns_blocks(self, client):
        resp = client.get("/blocks")
        assert resp.status_code == 200
        data = resp.json()
        assert "blocks" in data
        assert "totalLetters" in data
        assert isinstance(data["blocks"], list)
        assert all("letters" in b for b in data["blocks"])

    def test_total_letters_matches(self, client):
        data = client.get("/blocks").json()
        expected = sum(len(b["letters"]) for b in data["blocks"])
        assert data["totalLetters"] == expected


# ── POST /check ───────────────────────────────────────────────────────────────

class TestCheckPhrase:
    def test_formable_phrase(self, client):
        # 'by' should be formable with cabin blocks (b from bozt, y from yljdr)
        resp = client.post("/check", json={"phrase": "by"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["canForm"] is True
        assert len(data["blocksUsed"]) > 0

    def test_unformable_phrase(self, client):
        resp = client.post("/check", json={"phrase": "zzzzzzzzz"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["canForm"] is False

    def test_empty_phrase(self, client):
        resp = client.post("/check", json={"phrase": ""})
        assert resp.status_code == 422

    def test_missing_letters_returned(self, client):
        resp = client.post("/check", json={"phrase": "qqq"})
        data = resp.json()
        assert data["canForm"] is False
        assert "q" in data["missingLetters"]


# ── POST /builder/words ──────────────────────────────────────────────────────

class TestBuilderWords:
    def test_returns_available_words(self, client):
        resp = client.post("/builder/words", json={
            "all_blocks": ["c", "a", "t"],
            "chosen_words": [],
            "common_only": False,
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "availableWords" in data
        words = [w["word"] for w in data["availableWords"]]
        assert "cat" in words or "act" in words or "at" in words

    def test_context_filters(self, client):
        # With no context
        resp1 = client.post("/builder/words", json={
            "all_blocks": ["c", "ar", "at", "w"],
            "chosen_words": [],
            "common_only": False,
        })
        # With context "caw"
        resp2 = client.post("/builder/words", json={
            "all_blocks": ["c", "ar", "at", "w"],
            "chosen_words": ["caw"],
            "common_only": False,
        })
        words1 = resp1.json()["availableWords"]
        words2 = resp2.json()["availableWords"]
        assert len(words2) <= len(words1)

    def test_invalid_blocks(self, client):
        resp = client.post("/builder/words", json={
            "all_blocks": ["a1b"],
            "chosen_words": [],
        })
        assert resp.status_code == 422


# ── POST /builder/check ──────────────────────────────────────────────────────

class TestBuilderCheck:
    def test_word_can_form(self, client):
        resp = client.post("/builder/check", json={
            "word": "cat",
            "all_blocks": ["c", "a", "t"],
            "chosen_words": [],
        })
        assert resp.status_code == 200
        assert resp.json()["canForm"] is True

    def test_word_cannot_form(self, client):
        resp = client.post("/builder/check", json={
            "word": "dog",
            "all_blocks": ["c", "a", "t"],
            "chosen_words": [],
        })
        assert resp.status_code == 200
        assert resp.json()["canForm"] is False

    def test_word_conflicts_with_chosen(self, client):
        # All blocks used by "cat", so no more words possible
        resp = client.post("/builder/check", json={
            "word": "x",
            "all_blocks": ["c", "a", "t"],
            "chosen_words": ["cat"],
        })
        assert resp.status_code == 200
        assert resp.json()["canForm"] is False

    def test_invalid_word(self, client):
        resp = client.post("/builder/check", json={
            "word": "123",
            "all_blocks": ["a"],
            "chosen_words": [],
        })
        assert resp.status_code == 422
