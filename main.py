#!/usr/bin/env python3
"""
Block Phrase Builder
A tool to create phrases using blocks with letters on them.
Each block can only be used once per phrase.
"""

from itertools import combinations, permutations
from collections import Counter

# Try to load NLTK word list
try:
    import nltk
    try:
        from nltk.corpus import words
        NLTK_WORDS = set(w.lower() for w in words.words())
    except LookupError:
        print("Downloading NLTK corpus...")
        nltk.download('words')
        from nltk.corpus import words
        NLTK_WORDS = set(w.lower() for w in words.words())
except ImportError:
    print("Warning: NLTK not installed. Install with: pip install nltk")
    NLTK_WORDS = set()


class BlockPhraseBuilder:
    def __init__(self, blocks_file="blocks.txt"):
        """Initialize with blocks from a file."""
        self.blocks = self.load_blocks(blocks_file)
        self.available_letters = self._get_available_letters()

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
        Returns (True/False, list of blocks used, message)
        """
        # Normalize the phrase
        phrase_clean = phrase.replace(" ", "").lower()
        phrase_letters = Counter(phrase_clean)

        # Try to form the phrase using blocks
        blocks_used = []
        required_letters = phrase_letters.copy()

        for block in self.blocks:
            block_letters = Counter(block)

            # Check if this block helps fulfill our requirements
            overlap = required_letters & block_letters
            if overlap:
                blocks_used.append(block)
                for letter in block:
                    if letter in required_letters:
                        required_letters[letter] -= 1
                        if required_letters[letter] == 0:
                            del required_letters[letter]

        # Check if we've formed the complete phrase
        success = len(required_letters) == 0
        message = f"Phrase: '{phrase}'\n"

        if success:
            message += f"✓ Can be formed!\n"
            message += f"Blocks used: {blocks_used}\n"
        else:
            message += f"✗ Cannot be formed.\n"
            missing = dict(required_letters)
            message += f"Missing letters: {missing}\n"

        return success, blocks_used, message

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

    def _can_form_with_blocks(self, word, block_indices):
        """Check if a word can be formed using specific blocks."""
        word_lower = word.lower()
        word_letters = Counter(word_lower)
        block_letters = Counter()

        for idx in block_indices:
            for letter in self.blocks[idx]:
                block_letters[letter] += 1

        # Check if all letters in word exist in selected blocks
        for letter, count in word_letters.items():
            if block_letters[letter] < count:
                return False
        return True

    def find_possible_words(self, min_blocks=1, max_blocks=None):
        """
        Find all valid English words that can be formed from block combinations.
        Optimized to iterate through words once and find minimal block sets.
        Returns a dictionary organized by number of blocks and word length.
        """
        if not NLTK_WORDS:
            print("Error: Word dictionary not loaded. Install nltk: pip install nltk")
            return {}

        if max_blocks is None:
            max_blocks = len(self.blocks)

        results = {}
        word_results = {}  # Track results by word to avoid duplicates

        # Iterate through each word once
        for word in NLTK_WORDS:
            word_lower = word.lower()
            word_letters = Counter(word_lower)

            # Find the minimal set of blocks needed to form this word
            blocks_needed = []
            remaining_letters = word_letters.copy()

            for idx, block in enumerate(self.blocks):
                block_letters = Counter(block)
                # Check if this block helps
                overlap = remaining_letters & block_letters
                if overlap:
                    blocks_needed.append(idx)
                    for letter in block:
                        if letter in remaining_letters:
                            remaining_letters[letter] -= 1
                            if remaining_letters[letter] == 0:
                                del remaining_letters[letter]

            # If we could form the word
            if len(remaining_letters) == 0:
                num_blocks = len(blocks_needed)
                if min_blocks <= num_blocks <= max_blocks:
                    blocks_used = [self.blocks[i] for i in blocks_needed]
                    if word not in word_results:  # Store only first occurrence
                        word_results[word] = {
                            'word': word,
                            'blocks': blocks_used,
                            'num_blocks': num_blocks
                        }

        # Organize by number of blocks
        for word, item in word_results.items():
            num_blocks = item['num_blocks']
            if num_blocks not in results:
                results[num_blocks] = []
            results[num_blocks].append(item)

        # Sort each group by word length and alphabetically
        for num_blocks in results:
            results[num_blocks] = sorted(
                results[num_blocks],
                key=lambda x: (len(x['word']), x['word'])
            )

        return results

    def find_multiword_phrases(self, min_blocks_per_word=1, max_blocks_per_word=None, max_words=3):
        """
        Find multi-word phrases that can be formed using blocks.
        Each word is formed from different blocks (no reuse of blocks across words).
        """
        if not NLTK_WORDS:
            print("Error: Word dictionary not loaded. Install nltk: pip install nltk")
            return []

        if max_blocks_per_word is None:
            max_blocks_per_word = len(self.blocks)

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
                    for word in NLTK_WORDS:
                        if len(word) <= 6 and all(letter in available for letter in word.lower()):
                            if self._can_form_with_blocks(word, block_combo):
                                blocks_used = [self.blocks[i] for i in block_combo]
                                new_phrase = current_phrase + f" {word}" if current_phrase else word

                                # Recurse for next word
                                new_remaining = [b for b in remaining_blocks if b not in block_combo]
                                find_phrases_recursive(new_remaining, new_phrase, words_so_far + 1)

        all_block_indices = list(range(len(self.blocks)))
        find_phrases_recursive(all_block_indices, "", 0)

        return sorted(list(set(phrases)))  # Remove duplicates and sort



def main():
    """Main application loop."""
    builder = BlockPhraseBuilder()

    print("=" * 50)
    print("BLOCK PHRASE BUILDER")
    print("=" * 50)

    builder.get_block_info()

    print("\n=== Commands ===")
    print("1. Check if phrase can be formed")
    print("2. Find all possible words (single word)")
    print("3. Find multi-word phrases")
    print("4. View all blocks")
    print("5. Get block letter counts")
    print("6. Exit")

    while True:
        print()
        choice = input("Enter command (1-6): ").strip()

        if choice == "1":
            phrase = input("Enter phrase to check: ").strip()
            if phrase:
                success, blocks_used, message = builder.can_form_phrase(phrase)
                print(message)

        elif choice == "2":
            print("\nFinding all possible words... This may take a moment.")
            results = builder.find_possible_words()

            if not results:
                print("No words found or dictionary not loaded.")
            else:
                total_words = 0
                for num_blocks in sorted(results.keys()):
                    words_list = results[num_blocks]
                    if words_list:
                        print(f"\n=== Using {num_blocks} block(s) ({len(words_list)} words) ===")
                        for item in words_list[:20]:  # Show first 20 per group
                            print(f"  {item['word']:15} - Blocks: {', '.join(item['blocks'])}")
                        if len(words_list) > 20:
                            print(f"  ... and {len(words_list) - 20} more")
                        total_words += len(words_list)

                print(f"\nTotal words found: {total_words}")

        elif choice == "3":
            print("\nFinding multi-word phrases... This may take a moment.")
            phrases = builder.find_multiword_phrases(max_words=3)

            if not phrases:
                print("No multi-word phrases found or dictionary not loaded.")
            else:
                print(f"\n=== Found {len(phrases)} phrase(s) ===")
                for phrase in phrases[:50]:  # Show first 50
                    print(f"  {phrase}")
                if len(phrases) > 50:
                    print(f"  ... and {len(phrases) - 50} more")

        elif choice == "4":
            builder.get_block_info()

        elif choice == "5":
            print("\n=== Block Letter Counts ===")
            for i, block in enumerate(builder.blocks, 1):
                print(f"Block {i} ({block}): {len(block)} letters")

        elif choice == "6":
            print("Goodbye!")
            break

        else:
            print("Invalid choice. Please enter 1-6.")


if __name__ == "__main__":
    main()
