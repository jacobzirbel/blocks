import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BlocksService } from '../../services/blocks.service';
import { WordsByBlockCount, WordResult } from '../../models/blocks.models';

@Component({
  selector: 'app-word-finder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="finder-page">
      <h2>Find Possible Words</h2>
      <p class="hint">Find all English words that can be spelled using the available blocks.</p>

      <div class="controls">
        <label class="toggle">
          <input type="checkbox" [checked]="commonOnly()" (change)="commonOnly.set(!commonOnly())" />
          Common words only
        </label>
        <button (click)="search()" [disabled]="loading()">
          {{ loading() ? 'Searching...' : 'Find Words' }}
        </button>
      </div>

      @if (loading()) {
        <p class="status">Searching for words...</p>
      } @else if (error()) {
        <p class="status error">{{ error() }}</p>
      } @else if (searched()) {
        @if (totalWords() === 0) {
          <p class="status">No words found.</p>
        } @else {
          <p class="summary">Found <strong>{{ totalWords() }}</strong> words total</p>
          @for (group of wordGroups(); track group.numBlocks) {
            <div class="group">
              <h3>Using {{ group.numBlocks }} block{{ group.numBlocks === 1 ? '' : 's' }} ({{ group.words.length }})</h3>
              <div class="word-list">
                @for (item of group.words; track item.word) {
                  <div class="word-row">
                    <span class="word">{{ item.word }}</span>
                    <span class="blocks">
                      @for (b of item.blocks; track b) {
                        <span class="block-chip">{{ b }}</span>
                      }
                    </span>
                  </div>
                }
              </div>
            </div>
          }
        }
      }
    </div>
  `,
  styles: [`
    .finder-page { padding: 1.5rem; }
    h2 { margin: 0 0 0.5rem; }
    .hint { color: #666; margin-bottom: 1.5rem; }
    .controls { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
    .toggle { display: flex; align-items: center; gap: 0.4rem; cursor: pointer; }
    button {
      padding: 0.6rem 1.25rem;
      background: #1976d2;
      color: white;
      border: none;
      border-radius: 6px;
      font-size: 1rem;
      cursor: pointer;
    }
    button:disabled { background: #aaa; cursor: default; }
    .status { color: #666; }
    .error { color: #d32f2f; }
    .summary { margin-bottom: 1rem; }
    .group { margin-bottom: 1.5rem; }
    h3 { margin: 0 0 0.5rem; font-size: 1rem; color: #444; }
    .word-list { display: flex; flex-direction: column; gap: 0.4rem; }
    .word-row { display: flex; align-items: center; gap: 0.75rem; }
    .word { font-weight: 600; min-width: 100px; }
    .blocks { display: flex; gap: 0.3rem; flex-wrap: wrap; }
    .block-chip {
      background: #1976d2;
      color: white;
      padding: 0.15rem 0.5rem;
      border-radius: 4px;
      font-size: 0.8rem;
      font-family: monospace;
    }
  `],
})
export class WordFinder {
  private readonly service = inject(BlocksService);

  commonOnly = signal(true);
  loading = signal(false);
  error = signal<string | null>(null);
  searched = signal(false);

  private rawResults = signal<WordsByBlockCount>({});

  totalWords = computed(() =>
    Object.values(this.rawResults()).reduce((s, arr) => s + arr.length, 0)
  );

  wordGroups = computed(() =>
    Object.entries(this.rawResults())
      .map(([k, words]) => ({ numBlocks: Number(k), words: words as WordResult[] }))
      .sort((a, b) => a.numBlocks - b.numBlocks)
  );

  search() {
    this.loading.set(true);
    this.error.set(null);
    this.service.findWords(this.commonOnly()).subscribe({
      next: results => {
        this.rawResults.set(results);
        this.searched.set(true);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to find words.');
        this.loading.set(false);
      },
    });
  }
}
