# Block Phrase Builder

A Python tool to find and verify phrases using letter blocks, where each block can only be used once.

## Getting Started

### Installation

First, install the required NLTK library:
```bash
pip install nltk
```

### Files
- `blocks.txt` - Contains your blocks (one per line), each with up to 6 letters
- `main.py` - The main application

### Running the Project

```bash
python3 main.py
```

This will launch an interactive prompt with the following options:

1. **Check if a phrase can be formed** - Enter any phrase and verify if it can be created using your blocks
2. **Find all possible words** - Automatically finds all valid English words that can be formed from your blocks
3. **Find multi-word phrases** - Discovers phrases (2-3 words) that can be formed using different blocks for each word
4. **View all blocks** - See all available blocks
5. **Get block letter counts** - See how many letters are on each block
6. **Exit** - Close the application

## How It Works

- Each block contains letters (up to 6)
- A phrase can be formed if all its letters exist across your blocks
- Each block is used only once per phrase (blocks aren't reused)
- The tool is case-insensitive and ignores spaces
- Uses NLTK's English word corpus to find valid words
- Multi-word phrases use different blocks for each word (no block reuse)

## Features

- **Smart Word Finding** - Searches through thousands of English words to find which ones you can spell
- **Block Tracking** - Shows exactly which blocks are used for each word
- **Multi-word Phrases** - Combines multiple words to create complete phrases
- **Block Load Info** - Displays all available blocks and letter counts
- **Phrase Verification** - Check if specific phrases can be formed

## Example

With your current blocks:
```
1. anrxf      7. ly
2. zmnewq     8. hujiv
3. mwja       9. cpn
4. rexpji     10. bozt
5. jwo        11. fsw
6. yljdr
```

Possible words include:
- "joy" (using blocks: mwja, jwo, yljdr)
- "now" (using blocks: jwo, fsw)
- "few" (using blocks: fsw, zmnewq)
- And many more!

Multi-word phrases might include combinations like:
- "fly now"
- "raw joy"
- And more depending on available letters
