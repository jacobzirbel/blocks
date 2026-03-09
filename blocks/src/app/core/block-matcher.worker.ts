/// <reference lib="webworker" />
import {
  canFormWithBlocks,
  computeMissingLetters,
  findAvailableWords,
} from './block-matcher';

let wordList: string[] = [];

addEventListener('message', ({ data }) => {
  const { type, payload } = data;

  if (type === 'INIT') {
    wordList = payload.wordList;
    postMessage({ type: 'READY' });

  } else if (type === 'FIND_WORDS') {
    const { chosenWords, allBlocks, commonOnly, requestId } = payload;
    const results = findAvailableWords(chosenWords, allBlocks, wordList, commonOnly);
    postMessage({ type: 'WORDS_RESULT', payload: results, requestId });

  } else if (type === 'CHECK_WORD') {
    const { word, chosenWords, allBlocks, requestId } = payload;
    const combined = [...chosenWords, word].join('');
    const { matched } = canFormWithBlocks(combined, allBlocks);
    postMessage({ type: 'CHECK_RESULT', payload: { canForm: matched }, requestId });

  } else if (type === 'MISSING_LETTERS') {
    const { phrase, allBlocks, requestId } = payload;
    const letterCounts = [...phrase.replace(/ /g, '')].reduce(
      (acc, ch) => { acc[ch] = (acc[ch] ?? 0) + 1; return acc; },
      {} as Record<string, number>
    );
    const missing = computeMissingLetters(letterCounts, allBlocks);
    postMessage({ type: 'MISSING_RESULT', payload: missing, requestId });
  }
});
