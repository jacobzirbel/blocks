#!/usr/bin/env python3
"""
Block Phrase Builder
A tool to create phrases using blocks with letters on them.
Each block can only be used once per phrase.
"""
from __future__ import annotations

from itertools import combinations
from collections import Counter

# Try to load NLTK word list
try:
    import nltk
    try:
        from nltk.corpus import words, brown
        from nltk import FreqDist
        NLTK_WORDS = set(w.lower() for w in words.words())

        # Get common words from Brown corpus frequency
        try:
            brown_words = brown.words()
            freq_dist = FreqDist(w.lower() for w in brown_words if w.isalpha())
            # Get top 9000 most common words
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
        """Initialize with blocks from a file."""
        self.blocks = self.load_blocks(blocks_file)
        self.available_letters = self._get_available_letters()
        self._word_cache = {}  # keyed by (frozenset(block_indices), common_only)

    @classmethod
    def from_blocks(cls, blocks: list[str]) -> "BlockPhraseBuilder":
        """Initialize with a list of block strings instead of a file."""
        instance = cls.__new__(cls)
        instance.blocks = [b.strip().lower() for b in blocks if b.strip()]
        instance.available_letters = instance._get_available_letters()
        instance._word_cache = {}
        return instance

    def load_blocks(self, blocks_file):
        """Load blocks from file, filtering out empty blocks."""
        blocks = []
        with open(blocks_file, 'r') as f:
            for line in f:
                block = line.strip()
                if block:  # Skip empty lines
                    blocks.append(block)
        return blocks

    def _get_available_letters(self):
        """Get all available letters from all blocks."""
        all_letters = ''.join(self.blocks)
        return Counter(all_letters)

    def can_form_phrase(self, phrase):
        """
        Check if a phrase can be formed using the blocks.
        Uses bipartite matching against all blocks at once (no subset enumeration).
        Returns (True/False, list of blocks used, message)
        """
        phrase_clean = phrase.replace(" ", "").lower()
        phrase_letters = Counter(phrase_clean)

        all_indices = list(range(len(self.blocks)))
        found, used_indices = self._can_form_with_blocks_matching(
            phrase_clean, all_indices, return_assignment=True
        )
        best_blocks = [self.blocks[i] for i in sorted(used_indices)] if found else []

        message = f"Phrase: '{phrase}'\n"
        if found:
            message += f"✓ Can be formed!\n"
            message += f"Blocks used: {best_blocks}\n"
        else:
            message += f"✗ Cannot be formed.\n"
            missing = self._compute_missing_letters(phrase_letters)
            if missing:
                message += f"Missing letters: {dict(missing)}\n"
            else:
                message += "Cannot be formed due to block conflicts (letters compete for the same blocks).\n"

        return found, best_blocks, message

    def find_phrases_from_blocks(self, num_blocks=None):
        """
        Generate all possible combinations of blocks.
        Returns a list of block combinations.
        """
        if num_blocks is None:
            num_blocks = len(self.blocks)

        combinations_list = []
        for r in range(1, num_blocks + 1):
            for combo in combinations(range(len(self.blocks)), r):
                block_combo = [self.blocks[i] for i in combo]
                combinations_list.append(block_combo)

        return combinations_list

    def get_block_info(self):
        """Display information about available blocks."""
        print("\n=== Available Blocks ===")
        for i, block in enumerate(self.blocks, 1):
            print(f"{i:2d}. {block}")
        print(f"\nTotal blocks: {len(self.blocks)}")
        print(f"Total letters available: {sum(len(b) for b in self.blocks)}")

    def _can_form_with_blocks_matching(self, word, block_indices, return_assignment=False):
        """
        Check if a word can be formed using specific blocks via bipartite matching.
        Each letter occurrence must be matched to exactly one block containing it.
        Each block can only be used once.

        If return_assignment is True, returns (bool, set_of_used_block_indices)
        instead of just bool.
        """
        word_lower = word.lower()
        word_letters = Counter(word_lower)

        letters_to_match = []
        for letter, count in word_letters.items():
            letters_to_match.extend([letter] * count)

        if len(letters_to_match) > len(block_indices):
            return (False, set()) if return_assignment else False

        # Build adjacency: for each unique letter, which blocks can provide it
        letter_to_blocks = {}
        for letter in set(letters_to_match):
            letter_to_blocks[letter] = []
            for idx in block_indices:
                if letter in self.blocks[idx]:
                    letter_to_blocks[letter].append(idx)
            if not letter_to_blocks[letter]:
                return (False, set()) if return_assignment else False

        # Sort most-constrained letters first for faster pruning
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
        """
        Compute which letters are genuinely missing using augmenting-path
        maximum bipartite matching to find the true maximum, then report
        unmatched letter occurrences.
        Returns a dict of {letter: deficit_count}.
        """
        letters_to_match = []
        for letter, count in phrase_letters.items():
            letters_to_match.extend([letter] * count)

        all_indices = list(range(len(self.blocks)))
        # Adjacency: letter position -> list of block indices that contain it
        adj = []
        for letter in letters_to_match:
            adj.append([i for i in all_indices if letter in self.blocks[i]])

        # Hopcroft-Karp-style augmenting path matching
        # match_block[block] = letter position matched to it (or -1)
        match_block = {i: -1 for i in all_indices}
        # match_letter[pos] = block matched to it (or -1)
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

    def find_blocks_for_word(self, word, block_indices):
        """
        Find the block indices needed to form a word.
        The matching always uses exactly len(word) blocks (one per letter),
        which is the minimum possible.
        Returns (block_indices_used, block_strings) or (None, None) if impossible.
        """
        word_clean = word.replace(" ", "").lower()
        matched, used_indices = self._can_form_with_blocks_matching(
            word_clean, block_indices, return_assignment=True
        )
        if not matched:
            return None, None
        used_list = sorted(used_indices)
        return used_list, [self.blocks[i] for i in used_list]

    def find_possible_words(self, min_blocks=1, max_blocks=None, common_only=True, block_indices=None):
        """
        Find all valid English words that can be formed from block combinations.
        Checks each word once via bipartite matching (no subset enumeration).

        Args:
            min_blocks: Minimum blocks to use
            max_blocks: Maximum blocks to use
            common_only: If True, search only common words; if False, search all words
            block_indices: Optional list of block indices to restrict search to (defaults to all)
        """
        if not NLTK_WORDS:
            print("Error: Word dictionary not loaded. Install nltk: pip install nltk")
            return {}

        available_indices = block_indices if block_indices is not None else list(range(len(self.blocks)))

        cache_key = (frozenset(available_indices), common_only)
        if cache_key in self._word_cache:
            return self._word_cache[cache_key]

        if max_blocks is None:
            max_blocks = len(available_indices)

        word_set = COMMON_WORDS if common_only else NLTK_WORDS

        # Pre-compute available letters across all blocks for fast rejection
        available_letter_set = set()
        for idx in available_indices:
            available_letter_set.update(self.blocks[idx])

        results = {}

        for word in word_set:
            word_lower = word.lower()

            # Fast rejection: skip if word uses letters not on any block
            if not all(ch in available_letter_set for ch in word_lower):
                continue

            word_len = len(word_lower)
            if word_len < min_blocks or word_len > max_blocks:
                continue

            # Single matching call — no subset enumeration needed
            matched, used_indices = self._can_form_with_blocks_matching(
                word_lower, available_indices, return_assignment=True
            )
            if matched:
                num_blocks = len(used_indices)
                blocks_used = [self.blocks[i] for i in sorted(used_indices)]
                item = {'word': word_lower, 'blocks': blocks_used, 'num_blocks': num_blocks}
                results.setdefault(num_blocks, []).append(item)

        # Sort each group by word length and alphabetically
        for num_blocks in results:
            results[num_blocks] = sorted(
                results[num_blocks],
                key=lambda x: (len(x['word']), x['word'])
            )

        self._word_cache[cache_key] = results
        return results

    def find_words_for_context(self, context_phrase='', common_only=True):
        """
        Return all words that can be added to the given context phrase using this
        builder's blocks. A word W is included only if (context_phrase + W) can
        be spelled simultaneously from the available blocks, ensuring that picking
        W remains possible regardless of how the context blocks were assigned.
        """
        if not context_phrase.strip():
            return self.find_possible_words(common_only=common_only)

        # Early check: if context phrase uses all blocks, no words can be added
        can_form, blocks_used, _ = self.can_form_phrase(context_phrase)
        if not can_form or len(blocks_used) >= len(self.blocks):
            return {}

        all_words = self.find_possible_words(common_only=common_only)
        result = {}
        for num_blocks, words in all_words.items():
            filtered = [
                item for item in words
                if self.can_form_phrase((context_phrase + ' ' + item['word']).strip())[0]
            ]
            if filtered:
                result[num_blocks] = filtered
        return result

    def find_multiword_phrases(self, min_blocks_per_word=1, max_blocks_per_word=None, max_words=3, common_only=True):
        """
        Find multi-word phrases that can be formed using blocks.
        Each word is formed from different blocks (no reuse of blocks across words).

        Args:
            min_blocks_per_word: Minimum blocks per word
            max_blocks_per_word: Maximum blocks per word
            max_words: Maximum number of words in a phrase
            common_only: If True, use common words; if False, use all words
        """
        if not NLTK_WORDS:
            print("Error: Word dictionary not loaded. Install nltk: pip install nltk")
            return []

        if max_blocks_per_word is None:
            max_blocks_per_word = len(self.blocks)

        # Choose word set based on common_only parameter
        word_set = COMMON_WORDS if common_only else NLTK_WORDS

        phrases = []

        def find_phrases_recursive(remaining_blocks, current_phrase, words_so_far):
            """Recursively build phrases using different block combinations."""
            if words_so_far >= max_words or len(remaining_blocks) == 0:
                if current_phrase:
                    phrases.append(current_phrase)
                return

            # Try different block combinations for the next word
            for num_blocks in range(min_blocks_per_word, min(max_blocks_per_word + 1, len(remaining_blocks) + 1)):
                for block_combo in combinations(remaining_blocks, num_blocks):
                    # Get available letters from this combo
                    available = set()
                    for idx in block_combo:
                        available.update(self.blocks[idx])

                    # Find words using these blocks
                    for word in word_set:
                        if len(word) <= 6 and all(letter in available for letter in word.lower()):
                            if self._can_form_with_blocks_matching(word, block_combo):
                                blocks_used = [self.blocks[i] for i in block_combo]
                                new_phrase = current_phrase + f" {word}" if current_phrase else word

                                # Recurse for next word
                                new_remaining = [b for b in remaining_blocks if b not in block_combo]
                                find_phrases_recursive(new_remaining, new_phrase, words_so_far + 1)

        all_block_indices = list(range(len(self.blocks)))
        find_phrases_recursive(all_block_indices, "", 0)

        return sorted(list(set(phrases)))  # Remove duplicates and sort

    def export_words_to_file(self, results, filename, common_only=True):
        """
        Export word finding results to a file as a flat list.

        Args:
            results: Dictionary of results from find_possible_words
            filename: Output filename
            common_only: Whether these are common or all words
        """
        try:
            with open(filename, 'w') as f:
                for num_blocks in sorted(results.keys()):
                    words_list = results[num_blocks]
                    for item in words_list:
                        f.write(f"{item['word']}\n")

            print(f"✓ Results exported to {filename}")
            return True
        except Exception as e:
            print(f"✗ Error exporting to file: {e}")
            return False

    def export_phrases_to_file(self, phrases, filename):
        """
        Export phrase finding results to a file as a flat list.

        Args:
            phrases: List of phrase strings
            filename: Output filename
        """
        try:
            with open(filename, 'w') as f:
                for phrase in phrases:
                    f.write(f"{phrase}\n")

            print(f"✓ Results exported to {filename}")
            return True
        except Exception as e:
            print(f"✗ Error exporting to file: {e}")
            return False



def main():
    """Main application loop."""
    builder = BlockPhraseBuilder()

    # Store last results for exporting
    last_results = None
    last_results_type = None  # 'words_common', 'words_all', or 'phrases'

    print("=" * 50)
    print("BLOCK PHRASE BUILDER")
    print("=" * 50)

    builder.get_block_info()

    print("\n=== Commands ===")
    print("1. Check if phrase can be formed")
    print("2. Find all possible words (common words)")
    print("3. Find all possible words (all words)")
    print("4. Find multi-word phrases")
    print("5. Export last results to file")
    print("6. View all blocks")
    print("7. Get block letter counts")
    print("8. Build phrase interactively (pick words, remove blocks)")
    print("9. Exit")

    while True:
        print()
        choice = input("Enter command (1-9): ").strip()

        if choice == "1":
            phrase = input("Enter phrase to check: ").strip()
            if phrase:
                success, blocks_used, message = builder.can_form_phrase(phrase)
                print(message)

        elif choice == "2":
            print("\nFinding common words...")
            results = builder.find_possible_words(common_only=True)

            if not results:
                print("No words found.")
            else:
                total_words = 0
                for num_blocks in sorted(results.keys()):
                    words_list = results[num_blocks]
                    if words_list:
                        print(f"\n=== Using {num_blocks} block(s) ({len(words_list)} words) ===")
                        for item in words_list[:20]:
                            print(f"  {item['word']:15} - Blocks: {', '.join(item['blocks'])}")
                        if len(words_list) > 20:
                            print(f"  ... and {len(words_list) - 20} more")
                        total_words += len(words_list)

                print(f"\nTotal words found: {total_words}")
                last_results = results
                last_results_type = 'words_common'

        elif choice == "3":
            print("\nFinding all possible words... (this may take a moment)")
            results = builder.find_possible_words(common_only=False)

            if not results:
                print("No words found.")
            else:
                total_words = 0
                for num_blocks in sorted(results.keys()):
                    words_list = results[num_blocks]
                    if words_list:
                        print(f"\n=== Using {num_blocks} block(s) ({len(words_list)} words) ===")
                        for item in words_list[:20]:
                            print(f"  {item['word']:15} - Blocks: {', '.join(item['blocks'])}")
                        if len(words_list) > 20:
                            print(f"  ... and {len(words_list) - 20} more")
                        total_words += len(words_list)

                print(f"\nTotal words found: {total_words}")
                last_results = results
                last_results_type = 'words_all'

        elif choice == "4":
            print("\nFinding multi-word phrases...")
            phrases = builder.find_multiword_phrases(max_words=3, common_only=True)

            if not phrases:
                print("No multi-word phrases found.")
            else:
                print(f"\n=== Found {len(phrases)} phrase(s) ===")
                for phrase in phrases[:50]:
                    print(f"  {phrase}")
                if len(phrases) > 50:
                    print(f"  ... and {len(phrases) - 50} more")

                last_results = phrases
                last_results_type = 'phrases'

        elif choice == "5":
            if last_results is None:
                print("No results to export. Run a search first (options 2, 3, or 4).")
            else:
                filename = input("Enter filename to save to (default: results.txt): ").strip()
                if not filename:
                    filename = "results.txt"

                if last_results_type == 'phrases':
                    builder.export_phrases_to_file(last_results, filename)
                else:
                    is_common = last_results_type == 'words_common'
                    builder.export_words_to_file(last_results, filename, common_only=is_common)

        elif choice == "6":
            builder.get_block_info()

        elif choice == "7":
            print("\n=== Block Letter Counts ===")
            for i, block in enumerate(builder.blocks, 1):
                print(f"Block {i} ({block}): {len(block)} letters")

        elif choice == "8":
            remaining = list(range(len(builder.blocks)))
            phrase_words = []

            print("\n=== Interactive Phrase Builder ===")
            print("Find a word, remove those blocks, and keep going.")
            print("Type 'done' to finish or 'quit' to cancel.\n")

            while remaining:
                print(f"Remaining blocks: {[builder.blocks[i] for i in remaining]}")
                if phrase_words:
                    print(f"Phrase so far: {' '.join(phrase_words)}")

                print("\nFinding words with remaining blocks...")
                results = builder.find_possible_words(common_only=True, block_indices=remaining)

                if not results:
                    print("No more words can be formed.")
                    break

                # Flatten and display all found words with numbering
                options = []
                for num_blocks in sorted(results.keys()):
                    for item in results[num_blocks]:
                        options.append(item)

                print(f"\nFound {len(options)} word(s):")
                for i, item in enumerate(options, 1):
                    print(f"  {i:3}. {item['word']:15} - Blocks: {', '.join(item['blocks'])}")

                print()
                pick = input("Pick a number, type a word, 'done' to finish, or 'quit' to cancel: ").strip().lower()

                if pick == 'quit':
                    phrase_words = []
                    break
                elif pick == 'done':
                    break
                elif pick.isdigit():
                    idx = int(pick) - 1
                    if 0 <= idx < len(options):
                        chosen = options[idx]
                    else:
                        print("Invalid number.")
                        continue
                else:
                    # User typed a word directly — check options first, then validate against remaining blocks
                    matches = [o for o in options if o['word'] == pick]
                    if matches:
                        chosen = matches[0]
                    else:
                        indices_used, blocks_used = builder.find_blocks_for_word(pick, remaining)
                        if indices_used is None:
                            print(f"'{pick}' cannot be formed with the remaining blocks.")
                            continue
                        chosen = {'word': pick, 'blocks': blocks_used, '_indices': indices_used}

                phrase_words.append(chosen['word'])
                # Remove the blocks used by the chosen word
                used_block_strs = chosen['blocks']
                if '_indices' in chosen:
                    for i in chosen['_indices']:
                        remaining.remove(i)
                else:
                    used_remaining = list(remaining)
                    for block_str in used_block_strs:
                        for i in used_remaining:
                            if builder.blocks[i] == block_str:
                                remaining.remove(i)
                                used_remaining.remove(i)
                                break
                print(f"\n✓ Added '{chosen['word']}'. Blocks removed: {used_block_strs}\n")

            if phrase_words:
                print(f"\n=== Final Phrase: '{' '.join(phrase_words)}' ===")
                if remaining:
                    print(f"Unused blocks: {[builder.blocks[i] for i in remaining]}")

        elif choice == "9":
            print("Goodbye!")
            break

        else:
            print("Invalid choice. Please enter 1-9.")


if __name__ == "__main__":
    main()
