import { Injectable, signal } from '@angular/core';
import { WordResult } from './block-matcher';
import WORD_LIST from './wordlist.json';

interface Pending {
  type: string;
  payload: Record<string, unknown>;
  requestId: number;
  resolve: (v: unknown) => void;
  reject: (e: unknown) => void;
}

@Injectable({ providedIn: 'root' })
export class BlockMatcherService {
  private worker: Worker;
  private nextId = 0;
  private pending = new Map<number, Pending>();
  private queue: Pending[] = [];

  readonly ready = signal(false);

  constructor() {
    this.worker = new Worker(
      new URL('./block-matcher.worker', import.meta.url),
      { type: 'module' }
    );

    this.worker.onmessage = ({ data }) => {
      const { type, payload, requestId } = data;

      if (type === 'READY') {
        this.ready.set(true);
        for (const item of this.queue) {
          this.pending.set(item.requestId, item);
          this.worker.postMessage({ type: item.type, payload: { ...item.payload, requestId: item.requestId } });
        }
        this.queue = [];
        return;
      }

      const p = this.pending.get(requestId);
      if (p) {
        this.pending.delete(requestId);
        p.resolve(payload);
      }
    };

    this.worker.onerror = (err) => {
      for (const p of this.pending.values()) p.reject(err);
      for (const p of this.queue) p.reject(err);
      this.pending.clear();
      this.queue = [];
    };

    this.worker.postMessage({ type: 'INIT', payload: { wordList: WORD_LIST } });
  }

  private send<T>(type: string, payload: Record<string, unknown>): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = this.nextId++;
      const item: Pending = { type, payload, requestId, resolve: resolve as (v: unknown) => void, reject };

      if (this.ready()) {
        this.pending.set(requestId, item);
        this.worker.postMessage({ type, payload: { ...payload, requestId } });
      } else {
        this.queue.push(item);
      }
    });
  }

  findAvailableWords(chosenWords: string[], allBlocks: string[], commonOnly = true): Promise<WordResult[]> {
    return this.send('FIND_WORDS', { chosenWords, allBlocks, commonOnly });
  }

  checkWord(word: string, chosenWords: string[], allBlocks: string[]): Promise<boolean> {
    return this.send<{ canForm: boolean }>('CHECK_WORD', { word, chosenWords, allBlocks })
      .then(r => r.canForm);
  }

  getMissingLetters(phrase: string, allBlocks: string[]): Promise<Record<string, number>> {
    return this.send('MISSING_LETTERS', { phrase, allBlocks });
  }
}
