import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  BlocksInfo,
  PhraseCheckResult,
  WordsByBlockCount,
  PhraseBuilderState,
} from '../models/blocks.models';

const API_BASE = 'http://localhost:8000';

// Mock data reflecting blocks.txt: mwja, bozt, hujiv, fsw, zmnewq, anrxf, rexpji, jwo, yljdr, ly, cpn
const MOCK_BLOCKS = ['mwja', 'bozt', 'hujiv', 'fsw', 'zmnewq', 'anrxf', 'rexpji', 'jwo', 'yljdr', 'ly', 'cpn'];

const MOCK_WORDS_BY_COUNT: WordsByBlockCount = {
  2: [
    { word: 'by', blocks: ['bozt', 'yljdr'], numBlocks: 2 },
    { word: 'my', blocks: ['mwja', 'yljdr'], numBlocks: 2 },
    { word: 'no', blocks: ['cpn', 'jwo'], numBlocks: 2 },
    { word: 'or', blocks: ['jwo', 'anrxf'], numBlocks: 2 },
    { word: 'on', blocks: ['jwo', 'cpn'], numBlocks: 2 },
  ],
  3: [
    { word: 'joy', blocks: ['rexpji', 'jwo', 'yljdr'], numBlocks: 3 },
    { word: 'fly', blocks: ['fsw', 'ly', 'yljdr'], numBlocks: 3 },
    { word: 'wry', blocks: ['mwja', 'anrxf', 'yljdr'], numBlocks: 3 },
    { word: 'ply', blocks: ['cpn', 'ly', 'yljdr'], numBlocks: 3 },
    { word: 'nor', blocks: ['zmnewq', 'jwo', 'anrxf'], numBlocks: 3 },
  ],
  4: [
    { word: 'worn', blocks: ['jwo', 'bozt', 'anrxf', 'cpn'], numBlocks: 4 },
    { word: 'wren', blocks: ['mwja', 'anrxf', 'zmnewq', 'cpn'], numBlocks: 4 },
    { word: 'jinx', blocks: ['rexpji', 'hujiv', 'zmnewq', 'anrxf'], numBlocks: 4 },
  ],
};

const MOCK_PHRASES = ['joy wren', 'fly worn', 'nor ply', 'wry on'];

@Injectable({ providedIn: 'root' })
export class BlocksService {
  private readonly http = inject(HttpClient);
  private useMocks = true; // flip to false once server is running

  getBlocks(): Observable<BlocksInfo> {
    if (this.useMocks) {
      return of({
        blocks: MOCK_BLOCKS.map(l => ({ letters: l })),
        totalLetters: MOCK_BLOCKS.reduce((s, b) => s + b.length, 0),
      }).pipe(delay(200));
    }
    return this.http.get<BlocksInfo>(`${API_BASE}/blocks`);
  }

  checkPhrase(phrase: string): Observable<PhraseCheckResult> {
    if (this.useMocks) {
      const clean = phrase.replace(/\s/g, '').toLowerCase();
      const canForm = clean.length <= 6;
      return of({
        phrase,
        canForm,
        blocksUsed: canForm ? MOCK_BLOCKS.slice(0, 3) : [],
        missingLetters: (canForm ? {} : { q: 1 }) as Record<string, number>,
      }).pipe(delay(400));
    }
    return this.http.post<PhraseCheckResult>(`${API_BASE}/check`, { phrase });
  }

  findWords(commonOnly = true): Observable<WordsByBlockCount> {
    if (this.useMocks) {
      return of(MOCK_WORDS_BY_COUNT).pipe(delay(600));
    }
    return this.http.get<WordsByBlockCount>(`${API_BASE}/words`, {
      params: { common_only: String(commonOnly) },
    });
  }

  findPhrases(): Observable<string[]> {
    if (this.useMocks) {
      return of(MOCK_PHRASES).pipe(delay(800));
    }
    return this.http.get<string[]>(`${API_BASE}/phrases`);
  }

  getBuilderWords(remainingBlocks: string[]): Observable<PhraseBuilderState> {
    if (this.useMocks) {
      const words = Object.values(MOCK_WORDS_BY_COUNT)
        .flat()
        .filter(w => w.blocks.every((b: string) => remainingBlocks.includes(b)));
      return of({
        remainingBlocks,
        phraseWords: [],
        availableWords: words,
      }).pipe(delay(400));
    }
    return this.http.post<PhraseBuilderState>(`${API_BASE}/builder/words`, {
      remaining_blocks: remainingBlocks,
    });
  }
}
