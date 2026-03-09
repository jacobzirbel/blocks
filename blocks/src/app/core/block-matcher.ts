/**
 * Client-side port of the Python bipartite matching logic from main.py.
 * All functions are pure and stateless — safe to run in a Web Worker.
 */

export interface WordResult {
  word: string;
  blocks: string[];
  numBlocks: number;
}

/**
 * Port of _can_form_with_blocks_matching.
 * Backtracking bipartite matcher: each letter occurrence in `word` must be
 * assigned to a distinct block that contains it.
 */
export function canFormWithBlocks(
  word: string,
  blocks: string[]
): { matched: boolean; usedIndices: Set<number> } {
  const wordLower = word.toLowerCase();

  // Count letter occurrences
  const letterCount = new Map<string, number>();
  for (const ch of wordLower) {
    letterCount.set(ch, (letterCount.get(ch) ?? 0) + 1);
  }

  // Expand to flat list
  const lettersToMatch: string[] = [];
  for (const [letter, count] of letterCount) {
    for (let i = 0; i < count; i++) lettersToMatch.push(letter);
  }

  if (lettersToMatch.length > blocks.length) {
    return { matched: false, usedIndices: new Set() };
  }

  // Build adjacency: unique letter -> block indices containing it
  const letterToBlocks = new Map<string, number[]>();
  for (const letter of new Set(lettersToMatch)) {
    const candidates: number[] = [];
    for (let i = 0; i < blocks.length; i++) {
      if (blocks[i].includes(letter)) candidates.push(i);
    }
    if (candidates.length === 0) return { matched: false, usedIndices: new Set() };
    letterToBlocks.set(letter, candidates);
  }

  // Sort most-constrained letters first
  lettersToMatch.sort(
    (a, b) => letterToBlocks.get(a)!.length - letterToBlocks.get(b)!.length
  );

  const usedBlocks = new Set<number>();

  function backtrack(idx: number): boolean {
    if (idx === lettersToMatch.length) return true;
    const letter = lettersToMatch[idx];
    for (const blockIdx of letterToBlocks.get(letter)!) {
      if (!usedBlocks.has(blockIdx)) {
        usedBlocks.add(blockIdx);
        if (backtrack(idx + 1)) return true;
        usedBlocks.delete(blockIdx);
      }
    }
    return false;
  }

  const matched = backtrack(0);
  return { matched, usedIndices: matched ? new Set(usedBlocks) : new Set() };
}

/**
 * Port of _compute_missing_letters.
 * Augmenting-path maximum bipartite matching; returns unmatched letter
 * occurrences grouped by letter.
 */
export function computeMissingLetters(
  phraseLetters: Record<string, number>,
  blocks: string[]
): Record<string, number> {
  const lettersToMatch: string[] = [];
  for (const [letter, count] of Object.entries(phraseLetters)) {
    for (let i = 0; i < count; i++) lettersToMatch.push(letter);
  }

  const n = lettersToMatch.length;

  // adj[u] = block indices that contain lettersToMatch[u]
  const adj: number[][] = lettersToMatch.map(letter =>
    blocks.map((b, i) => (b.includes(letter) ? i : -1)).filter(i => i !== -1)
  );

  const matchBlock = new Map<number, number>(); // block idx -> letter pos
  const matchLetter = new Array<number>(n).fill(-1);

  function tryAugment(u: number, visited: Set<number>): boolean {
    for (const v of adj[u]) {
      if (visited.has(v)) continue;
      visited.add(v);
      const prev = matchBlock.get(v) ?? -1;
      if (prev === -1 || tryAugment(prev, visited)) {
        matchLetter[u] = v;
        matchBlock.set(v, u);
        return true;
      }
    }
    return false;
  }

  for (let u = 0; u < n; u++) {
    tryAugment(u, new Set());
  }

  const missing: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    if (matchLetter[i] === -1) {
      const letter = lettersToMatch[i];
      missing[letter] = (missing[letter] ?? 0) + 1;
    }
  }
  return missing;
}

/**
 * Port of find_words_for_context (simplified — no get_combined_block_assignments).
 *
 * 1. Run canFormWithBlocks on the joined chosen words to find which block
 *    indices are consumed (treats the whole phrase as one letter sequence).
 * 2. Remaining blocks = allBlocks minus consumed indices.
 * 3. For each word in wordList: fast-reject then match against remaining blocks.
 */
export function findAvailableWords(
  chosenWords: string[],
  allBlocks: string[],
  wordList: string[],
  _commonOnly: boolean
): WordResult[] {
  let remainingBlocks: string[];

  if (chosenWords.length === 0) {
    remainingBlocks = allBlocks;
  } else {
    const phrase = chosenWords.join('');
    const { matched, usedIndices } = canFormWithBlocks(phrase, allBlocks);
    if (!matched) return [];
    remainingBlocks = allBlocks.filter((_, i) => !usedIndices.has(i));
  }

  const availableLetterSet = new Set(remainingBlocks.join(''));
  const results: WordResult[] = [];

  for (const word of wordList) {
    // Fast reject: any letter not present in any remaining block
    if (![...word].every(ch => availableLetterSet.has(ch))) continue;

    const { matched, usedIndices } = canFormWithBlocks(word, remainingBlocks);
    if (matched) {
      const usedBlockStrings = [...usedIndices].map(i => remainingBlocks[i]);
      results.push({ word, blocks: usedBlockStrings, numBlocks: usedIndices.size });
    }
  }

  results.sort(
    (a, b) =>
      a.numBlocks - b.numBlocks ||
      a.word.length - b.word.length ||
      a.word.localeCompare(b.word)
  );
  return results;
}
