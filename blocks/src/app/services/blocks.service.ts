import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { delay } from 'rxjs/operators';
import {
  BlocksInfo,
  PhraseCheckResult,
  WordsByBlockCount,
} from '../models/blocks.models';
import { BlockConfigService } from './block-config.service';

const API_BASE = 'http://localhost:8000';
// const API_BASE = '/api';

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
  private readonly blockConfig = inject(BlockConfigService);
  private useMocks = false;

  getBlocks(): Observable<BlocksInfo> {
    if (this.useMocks) {
      const blocks = this.blockConfig.blocks();
      return of({
        blocks: blocks.map((l: string) => ({ letters: l })),
        totalLetters: blocks.reduce((s: number, b: string) => s + b.length, 0),
      }).pipe(delay(200));
    }
    return this.http.get<BlocksInfo>(`${API_BASE}/blocks`);
  }

  checkPhrase(phrase: string): Observable<PhraseCheckResult> {
    if (this.useMocks) {
      const clean = phrase.replace(/\s/g, '').toLowerCase();
      const canForm = clean.length <= 6;
      const blocks = this.blockConfig.blocks();
      return of({
        phrase,
        canForm,
        blocksUsed: canForm ? blocks.slice(0, 3) : [],
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
}
