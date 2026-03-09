export interface Block {
  letters: string;
}

export interface BlocksInfo {
  blocks: Block[];
  totalLetters: number;
}

export interface PhraseCheckResult {
  phrase: string;
  canForm: boolean;
  blocksUsed: string[];
  missingLetters: Record<string, number>;
}

export interface WordResult {
  word: string;
  blocks: string[];
  numBlocks: number;
}

export interface WordsByBlockCount {
  [numBlocks: number]: WordResult[];
}

