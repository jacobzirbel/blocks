"""Tests for BlockPhraseBuilder core logic."""
import pytest
from main import BlockPhraseBuilder


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def simple_builder():
    """Blocks: c, ar, at, w — good for testing ambiguous matching."""
    return BlockPhraseBuilder.from_blocks(["c", "ar", "at", "w"])


@pytest.fixture
def cabin_builder():
    """The real cabin blocks."""
    return BlockPhraseBuilder.from_blocks(
        ["mwja", "bozt", "hujiv", "fsw", "zmnewq", "anrxf", "rexpji", "jwo", "yljdr", "ly", "cpn"]
    )


@pytest.fixture
def hello_builder():
    """Blocks designed for spelling 'hello' and related words."""
    return BlockPhraseBuilder.from_blocks(["h", "e", "l", "l", "o", "ae", "w", "r", "d"])


# ── from_blocks ───────────────────────────────────────────────────────────────

class TestFromBlocks:
    def test_creates_builder(self):
        b = BlockPhraseBuilder.from_blocks(["ab", "cd"])
        assert b.blocks == ["ab", "cd"]

    def test_lowercases_blocks(self):
        b = BlockPhraseBuilder.from_blocks(["AB", "Cd"])
        assert b.blocks == ["ab", "cd"]

    def test_strips_whitespace(self):
        b = BlockPhraseBuilder.from_blocks(["  ab ", " cd"])
        assert b.blocks == ["ab", "cd"]

    def test_filters_empty_blocks(self):
        b = BlockPhraseBuilder.from_blocks(["ab", "", "  ", "cd"])
        assert b.blocks == ["ab", "cd"]

    def test_available_letters(self):
        b = BlockPhraseBuilder.from_blocks(["ab", "bc"])
        assert b.available_letters["a"] == 1
        assert b.available_letters["b"] == 2
        assert b.available_letters["c"] == 1


# ── can_form_phrase ───────────────────────────────────────────────────────────

class TestCanFormPhrase:
    def test_single_letter_match(self):
        b = BlockPhraseBuilder.from_blocks(["a", "b", "c"])
        found, blocks, _ = b.can_form_phrase("a")
        assert found
        assert "a" in blocks

    def test_simple_word(self, simple_builder):
        found, blocks, _ = simple_builder.can_form_phrase("cat")
        assert found
        assert len(blocks) == 3

    def test_word_with_spaces(self, simple_builder):
        found, _, _ = simple_builder.can_form_phrase("c at")
        assert found

    def test_case_insensitive(self, simple_builder):
        found, _, _ = simple_builder.can_form_phrase("CAT")
        assert found

    def test_cannot_form_missing_letter(self, simple_builder):
        found, _, _ = simple_builder.can_form_phrase("dog")
        assert not found

    def test_cannot_form_not_enough_blocks(self):
        b = BlockPhraseBuilder.from_blocks(["a"])
        found, _, _ = b.can_form_phrase("aa")
        assert not found

    def test_empty_phrase(self):
        b = BlockPhraseBuilder.from_blocks(["a"])
        found, blocks, _ = b.can_form_phrase("")
        assert found
        assert blocks == []

    def test_multi_word_phrase(self, hello_builder):
        # hello_builder has: h, e, l, l, o, ae, w, r, d
        # "hero weld" = h, e, r, o, w, e(ae), l, d — 8 blocks, all unique
        found, _, _ = hello_builder.can_form_phrase("hero weld")
        assert found

    def test_missing_letters_reported(self):
        b = BlockPhraseBuilder.from_blocks(["a", "b"])
        found, _, message = b.can_form_phrase("xyz")
        assert not found
        assert "Missing" in message or "Cannot" in message


# ── Bipartite matching edge cases ─────────────────────────────────────────────

class TestBipartiteMatching:
    """The core algorithm — these are the tests that protect the 'black box'."""

    def test_two_blocks_with_same_letter(self):
        """Two blocks both have 'e', word needs one 'e' — should work."""
        b = BlockPhraseBuilder.from_blocks(["ae", "be"])
        found, _, _ = b.can_form_phrase("e")
        assert found

    def test_two_es_need_two_blocks(self):
        """Word 'ee' needs two blocks that each have 'e'."""
        b = BlockPhraseBuilder.from_blocks(["ae", "be"])
        # 'ee' needs 2 e's — one from 'ae', one from 'be'
        result = b._can_form_with_blocks_matching("ee", [0, 1])
        assert result

    def test_competing_letters_backtrack(self):
        """Letters compete for same block — requires backtracking."""
        # Block 0: 'ab', Block 1: 'a'
        # Word 'ab': a needs block 0 or 1, b needs block 0
        # Must assign b->block0, a->block1
        b = BlockPhraseBuilder.from_blocks(["ab", "a"])
        result = b._can_form_with_blocks_matching("ab", [0, 1])
        assert result

    def test_impossible_matching(self):
        """Two letters both need the same single block."""
        b = BlockPhraseBuilder.from_blocks(["ab"])
        result = b._can_form_with_blocks_matching("ab", [0])
        assert not result

    def test_constraint_ordering(self):
        """Most-constrained-first heuristic should still find solution."""
        # Block layout where naive greedy fails
        b = BlockPhraseBuilder.from_blocks(["ab", "bc", "cd"])
        # Word 'abd': a->block0, b->block0 or block1, d->block2
        # b must go to block1 since a needs block0
        result = b._can_form_with_blocks_matching("abd", [0, 1, 2])
        assert result

    def test_return_assignment(self):
        b = BlockPhraseBuilder.from_blocks(["a", "b", "c"])
        result, used = b._can_form_with_blocks_matching("ab", [0, 1, 2], return_assignment=True)
        assert result
        assert used == {0, 1}

    def test_return_assignment_failure(self):
        b = BlockPhraseBuilder.from_blocks(["a"])
        result, used = b._can_form_with_blocks_matching("z", [0], return_assignment=True)
        assert not result
        assert used == set()

    def test_more_letters_than_blocks(self):
        b = BlockPhraseBuilder.from_blocks(["abc"])
        result = b._can_form_with_blocks_matching("abc", [0])
        assert not result

    def test_caw_scenario(self, simple_builder):
        """The user's example: blocks c, ar, at, w — 'caw' should work."""
        found, _, _ = simple_builder.can_form_phrase("caw")
        assert found

    def test_caw_doesnt_lock_blocks(self, simple_builder):
        """After 'caw', both 'ar' and 'at' style words should still be available."""
        # 'caw' can use c + ar(a) + w OR c + at(a) + w
        # So 'caw r' should work (caw via at, r via ar)
        # and 'caw t' should work (caw via ar, t via at)
        found_r, _, _ = simple_builder.can_form_phrase("caw r")
        found_t, _, _ = simple_builder.can_form_phrase("caw t")
        assert found_r  # c->c, a->at, w->w, r->ar
        assert found_t  # c->c, a->ar, w->w, t->at

    def test_duplicate_blocks(self):
        """Two identical blocks."""
        b = BlockPhraseBuilder.from_blocks(["ab", "ab"])
        result = b._can_form_with_blocks_matching("aa", [0, 1])
        assert result


# ── compute_missing_letters ───────────────────────────────────────────────────

class TestComputeMissingLetters:
    def test_no_missing(self):
        b = BlockPhraseBuilder.from_blocks(["a", "b"])
        from collections import Counter
        missing = b._compute_missing_letters(Counter("ab"))
        assert missing == {}

    def test_missing_letter(self):
        b = BlockPhraseBuilder.from_blocks(["a", "b"])
        from collections import Counter
        missing = b._compute_missing_letters(Counter("abc"))
        assert missing == {"c": 1}

    def test_missing_count(self):
        b = BlockPhraseBuilder.from_blocks(["a"])
        from collections import Counter
        missing = b._compute_missing_letters(Counter("aaa"))
        assert missing == {"a": 2}


# ── get_combined_block_assignments ─────────────────────────────────────────────

class TestCombinedBlockAssignments:
    def test_single_word(self):
        b = BlockPhraseBuilder.from_blocks(["c", "a", "t"])
        result = b.get_combined_block_assignments("cat")
        assert result is not None
        assert len(result) == 1  # one word
        blocks_used = {a['block'] for a in result[0]}
        assert blocks_used == {"c", "a", "t"}

    def test_two_words_no_reuse(self):
        b = BlockPhraseBuilder.from_blocks(["c", "ar", "at", "w"])
        result = b.get_combined_block_assignments("caw r")
        assert result is not None
        assert len(result) == 2
        # Collect ALL blocks used across words
        all_blocks = [a['block'] for word_assigns in result for a in word_assigns]
        assert len(all_blocks) == len(set(all_blocks)), "blocks must not repeat across words"

    def test_caw_t_uses_different_a_block(self):
        """'caw t': caw must use ar(a) so at remains for t."""
        b = BlockPhraseBuilder.from_blocks(["c", "ar", "at", "w"])
        result = b.get_combined_block_assignments("caw t")
        assert result is not None
        # Word 'caw' should use ar for 'a' (not at), leaving at for 't'
        caw_blocks = {a['block'] for a in result[0]}
        t_blocks = {a['block'] for a in result[1]}
        assert "at" in t_blocks
        assert caw_blocks & t_blocks == set(), "no overlap"

    def test_impossible_phrase(self):
        b = BlockPhraseBuilder.from_blocks(["a"])
        assert b.get_combined_block_assignments("ab") is None

    def test_empty_phrase(self):
        b = BlockPhraseBuilder.from_blocks(["a"])
        assert b.get_combined_block_assignments("") == []

    def test_used_letter_correct(self):
        b = BlockPhraseBuilder.from_blocks(["abc", "def"])
        result = b.get_combined_block_assignments("ad")
        assert result is not None
        assigns = result[0]
        letters_used = {a['usedLetter'] for a in assigns}
        assert letters_used == {'a', 'd'}


class TestFindWordsForContextBlockAccuracy:
    """Verify that blocks returned per word reflect the combined assignment."""

    def test_no_block_reuse_in_results(self):
        b = BlockPhraseBuilder.from_blocks(["c", "ar", "at", "w"])
        # Context is "caw", find words that can follow it
        results = b.find_words_for_context("caw", common_only=False)
        for num_blocks, words in results.items():
            for item in words:
                # Each word's blocks should not overlap with blocks needed for "caw"
                combined = "caw " + item['word']
                assignments = b.get_combined_block_assignments(combined)
                assert assignments is not None
                all_blocks_flat = [a['block'] for wa in assignments for a in wa]
                assert len(all_blocks_flat) == len(set(all_blocks_flat)), \
                    f"block reuse in '{combined}': {all_blocks_flat}"


# ── find_blocks_for_word ──────────────────────────────────────────────────────

class TestFindBlocksForWord:
    def test_finds_blocks(self):
        b = BlockPhraseBuilder.from_blocks(["h", "e", "l"])
        indices, blocks = b.find_blocks_for_word("hel", [0, 1, 2])
        assert indices is not None
        assert set(blocks) == {"h", "e", "l"}

    def test_returns_none_for_impossible(self):
        b = BlockPhraseBuilder.from_blocks(["a", "b"])
        indices, blocks = b.find_blocks_for_word("xyz", [0, 1])
        assert indices is None
        assert blocks is None

    def test_ignores_spaces(self):
        b = BlockPhraseBuilder.from_blocks(["h", "i"])
        indices, _ = b.find_blocks_for_word("h i", [0, 1])
        assert indices is not None


# ── find_words_for_context ────────────────────────────────────────────────────

class TestFindWordsForContext:
    def test_empty_context_returns_all(self, simple_builder):
        results = simple_builder.find_words_for_context("", common_only=False)
        all_results = simple_builder.find_possible_words(common_only=False)
        assert results == all_results

    def test_context_filters_words(self, simple_builder):
        # With context "c", fewer words should be available than with no context
        all_words = simple_builder.find_words_for_context("", common_only=False)
        filtered = simple_builder.find_words_for_context("c", common_only=False)
        total_all = sum(len(v) for v in all_words.values())
        total_filtered = sum(len(v) for v in filtered.values())
        assert total_filtered <= total_all

    def test_impossible_context_returns_empty(self):
        b = BlockPhraseBuilder.from_blocks(["a", "b"])
        result = b.find_words_for_context("xyz", common_only=False)
        assert result == {}

    def test_all_blocks_used_returns_empty(self):
        b = BlockPhraseBuilder.from_blocks(["a", "b"])
        result = b.find_words_for_context("ab", common_only=False)
        assert result == {}


# ── find_possible_words ───────────────────────────────────────────────────────

class TestFindPossibleWords:
    def test_returns_dict(self, simple_builder):
        results = simple_builder.find_possible_words(common_only=False)
        assert isinstance(results, dict)

    def test_words_are_valid(self, simple_builder):
        results = simple_builder.find_possible_words(common_only=False)
        for num_blocks, words in results.items():
            for item in words:
                assert len(item["word"]) == item["num_blocks"]
                assert item["num_blocks"] == num_blocks

    def test_caching(self, simple_builder):
        r1 = simple_builder.find_possible_words(common_only=False)
        r2 = simple_builder.find_possible_words(common_only=False)
        assert r1 is r2  # same object from cache

    def test_common_vs_all(self, cabin_builder):
        common = cabin_builder.find_possible_words(common_only=True)
        all_words = cabin_builder.find_possible_words(common_only=False)
        total_common = sum(len(v) for v in common.values())
        total_all = sum(len(v) for v in all_words.values())
        assert total_all >= total_common

    def test_sorted_by_length_then_alpha(self, simple_builder):
        results = simple_builder.find_possible_words(common_only=False)
        for words in results.values():
            for i in range(1, len(words)):
                prev, curr = words[i - 1], words[i]
                assert (len(prev["word"]), prev["word"]) <= (len(curr["word"]), curr["word"])
