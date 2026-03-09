#!/usr/bin/env python3
"""
Block Phrase Builder — core logic used by server.py.
"""
from __future__ import annotations

from itertools import combinations
from collections import Counter

try:
    import nltk
    try:
        from nltk.corpus import words, brown
        from nltk import FreqDist
        NLTK_WORDS = set(w.lower() for w in words.words())

        try:
            brown_words = brown.words()
            freq_dist = FreqDist(w.lower() for w in brown_words if w.isalpha())
            COMMON_WORDS = set(word for word, _ in freq_dist.most_common(9000))
        except LookupError:
            nltk.download('brown', quiet=True)
            brown_words = brown.words()
            freq_dist = FreqDist(w.lower() for w in brown_words if w.isalpha())
            COMMON_WORDS = set(word for word, _ in freq_dist.most_common(9000))

    except LookupError:
        print("Downloading NLTK corpus...")
        nltk.download('words', quiet=True)
        nltk.download('brown', quiet=True)
        from nltk.corpus import words, brown
        from nltk import FreqDist
        NLTK_WORDS = set(w.lower() for w in words.words())
        brown_words = brown.words()
        freq_dist = FreqDist(w.lower() for w in brown_words if w.isalpha())
        COMMON_WORDS = set(word for word, _ in freq_dist.most_common(9000))
except ImportError:
    print("Warning: NLTK not installed. Install with: pip install nltk")
    NLTK_WORDS = set()
    COMMON_WORDS = set()


class BlockPhraseBuilder:
    def __init__(self, blocks_file="blocks.txt"):
        self.blocks = self.load_blocks(blocks_file)
        self.available_letters = self._get_available_letters()
        self._word_cache = {}

    @classmethod
    def from_blocks(cls, blocks: list[str]) -> "BlockPhraseBuilder":
        instance = cls.__new__(cls)
        instance.blocks = [b.strip().lower() for b in blocks if b.strip()]
        instance.available_letters = instance._get_available_letters()
        instance._word_cache = {}
        return instance

    def load_blocks(self, blocks_file):
        blocks = []
        with open(blocks_file, 'r') as f:
            for line in f:
                block = line.strip()
                if block:
                    blocks.append(block)
        return blocks

    def _get_available_letters(self):
        return Counter(''.join(self.blocks))

    def can_form_phrase(self, phrase):
        phrase_clean = phrase.replace(" ", "").lower()
        phrase_letters = Counter(phrase_clean)

        all_indices = list(range(len(self.blocks)))
        found, used_indices = self._can_form_with_blocks_matching(
            phrase_clean, all_indices, return_assignment=True
        )
        best_blocks = [self.blocks[i] for i in sorted(used_indices)] if found else []

        message = f"Phrase: '{phrase}'\n"
        if found:
            message += f"✓ Can be formed!\nBlocks used: {best_blocks}\n"
        else:
            message += "✗ Cannot be formed.\n"
            missing = self._compute_missing_letters(phrase_letters)
            if missing:
                message += f"Missing letters: {dict(missing)}\n"
            else:
                message += "Cannot be formed due to block conflicts.\n"

        return found, best_blocks, message

    def _can_form_with_blocks_matching(self, word, block_indices, return_assignment=False):
        word_lower = word.lower()
        word_letters = Counter(word_lower)

        letters_to_match = []
        for letter, count in word_letters.items():
            letters_to_match.extend([letter] * count)

        if len(letters_to_match) > len(block_indices):
            return (False, set()) if return_assignment else False

        letter_to_blocks = {}
        for letter in set(letters_to_match):
            letter_to_blocks[letter] = [
                idx for idx in block_indices if letter in self.blocks[idx]
            ]
            if not letter_to_blocks[letter]:
                return (False, set()) if return_assignment else False

        letters_to_match.sort(key=lambda l: len(letter_to_blocks[l]))

        used_blocks = set()

        def backtrack(letter_idx):
            if letter_idx == len(letters_to_match):
                return True
            letter = letters_to_match[letter_idx]
            for block_idx in letter_to_blocks[letter]:
                if block_idx not in used_blocks:
                    used_blocks.add(block_idx)
                    if backtrack(letter_idx + 1):
                        return True
                    used_blocks.remove(block_idx)
            return False

        result = backtrack(0)
        if return_assignment:
            return result, set(used_blocks) if result else set()
        return result

    def _compute_missing_letters(self, phrase_letters):
        letters_to_match = []
        for letter, count in phrase_letters.items():
            letters_to_match.extend([letter] * count)

        all_indices = list(range(len(self.blocks)))
        adj = [
            [i for i in all_indices if letter in self.blocks[i]]
            for letter in letters_to_match
        ]

        match_block = {i: -1 for i in all_indices}
        match_letter = [-1] * len(letters_to_match)

        def try_augment(u, visited):
            for v in adj[u]:
                if v in visited:
                    continue
                visited.add(v)
                if match_block[v] == -1 or try_augment(match_block[v], visited):
                    match_letter[u] = v
                    match_block[v] = u
                    return True
            return False

        for u in range(len(letters_to_match)):
            try_augment(u, set())

        missing: dict[str, int] = {}
        for i, letter in enumerate(letters_to_match):
            if match_letter[i] == -1:
                missing[letter] = missing.get(letter, 0) + 1
        return missing

    def find_possible_words(self, min_blocks=1, max_blocks=None, common_only=True, block_indices=None):
        if not NLTK_WORDS:
            return {}

        available_indices = block_indices if block_indices is not None else list(range(len(self.blocks)))

        cache_key = (frozenset(available_indices), common_only)
        if cache_key in self._word_cache:
            return self._word_cache[cache_key]

        if max_blocks is None:
            max_blocks = len(available_indices)

        word_set = COMMON_WORDS if common_only else NLTK_WORDS

        available_letter_set = set()
        for idx in available_indices:
            available_letter_set.update(self.blocks[idx])

        results = {}

        for word in word_set:
            word_lower = word.lower()
            if not all(ch in available_letter_set for ch in word_lower):
                continue
            word_len = len(word_lower)
            if word_len < min_blocks or word_len > max_blocks:
                continue
            matched, used_indices = self._can_form_with_blocks_matching(
                word_lower, available_indices, return_assignment=True
            )
            if matched:
                num_blocks = len(used_indices)
                blocks_used = [self.blocks[i] for i in sorted(used_indices)]
                item = {'word': word_lower, 'blocks': blocks_used, 'num_blocks': num_blocks}
                results.setdefault(num_blocks, []).append(item)

        for num_blocks in results:
            results[num_blocks] = sorted(
                results[num_blocks],
                key=lambda x: (len(x['word']), x['word'])
            )

        self._word_cache[cache_key] = results
        return results

    def find_multiword_phrases(self, min_blocks_per_word=1, max_blocks_per_word=None, max_words=3, common_only=True):
        if not NLTK_WORDS:
            return []

        if max_blocks_per_word is None:
            max_blocks_per_word = len(self.blocks)

        word_set = COMMON_WORDS if common_only else NLTK_WORDS
        phrases = []

        def find_phrases_recursive(remaining_blocks, current_phrase, words_so_far):
            if words_so_far >= max_words or len(remaining_blocks) == 0:
                if current_phrase:
                    phrases.append(current_phrase)
                return

            for num_blocks in range(min_blocks_per_word, min(max_blocks_per_word + 1, len(remaining_blocks) + 1)):
                for block_combo in combinations(remaining_blocks, num_blocks):
                    available = set()
                    for idx in block_combo:
                        available.update(self.blocks[idx])

                    for word in word_set:
                        if len(word) <= 6 and all(letter in available for letter in word.lower()):
                            if self._can_form_with_blocks_matching(word, block_combo):
                                new_phrase = current_phrase + f" {word}" if current_phrase else word
                                new_remaining = [b for b in remaining_blocks if b not in block_combo]
                                find_phrases_recursive(new_remaining, new_phrase, words_so_far + 1)

        find_phrases_recursive(list(range(len(self.blocks))), "", 0)
        return sorted(list(set(phrases)))
