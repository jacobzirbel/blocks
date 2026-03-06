import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { BlocksService } from '../../services/blocks.service';
import { WordResult } from '../../models/blocks.models';

const ALL_BLOCKS = ['mwja', 'bozt', 'hujiv', 'fsw', 'zmnewq', 'anrxf', 'rexpji', 'jwo', 'yljdr', 'ly', 'cpn'];

@Component({
  selector: 'app-phrase-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="builder-page">
      <h2>Interactive Phrase Builder</h2>
      <p class="hint">Pick a word, remove those blocks, and keep building your phrase.</p>

      <div class="phrase-bar">
        <span class="label">Phrase so far:</span>
        @if (phraseWords().length === 0) {
          <em class="empty">none yet</em>
        } @else {
          <strong class="phrase">{{ phraseWords().join(' ') }}</strong>
        }
        <button class="reset-btn" (click)="reset()">Reset</button>
      </div>

      <div class="blocks-remaining">
        <span class="label">Remaining blocks:</span>
        @for (b of remainingBlocks(); track b) {
          <span class="block-chip">{{ b }}</span>
        }
        @if (remainingBlocks().length === 0) {
          <em>none</em>
        }
      </div>

      @if (loading()) {
        <p class="status">Finding words...</p>
      } @else if (availableWords().length === 0) {
        <p class="status">No more words can be formed with remaining blocks.</p>
      } @else {
        <h3>Available words ({{ availableWords().length }})</h3>
        <div class="word-list">
          @for (item of availableWords(); track item.word) {
            <button class="word-btn" (click)="pickWord(item)">
              <span class="word">{{ item.word }}</span>
              <span class="blocks">
                @for (b of item.blocks; track b) {
                  <span class="mini-chip">{{ b }}</span>
                }
              </span>
            </button>
          }
        </div>
      }

      @if (phraseWords().length > 0) {
        <div class="final">
          <strong>Final phrase:</strong> "{{ phraseWords().join(' ') }}"
        </div>
      }
    </div>
  `,
  styles: [`
    .builder-page { padding: 1.5rem; }
    h2 { margin: 0 0 0.5rem; }
    .hint { color: #666; margin-bottom: 1.5rem; }
    .phrase-bar {
      display: flex; align-items: center; gap: 0.75rem;
      background: #f5f5f5; border-radius: 8px; padding: 0.75rem 1rem;
      margin-bottom: 1rem;
    }
    .label { font-size: 0.85rem; color: #555; white-space: nowrap; }
    .empty { color: #aaa; font-size: 0.9rem; }
    .phrase { font-size: 1.1rem; flex: 1; }
    .reset-btn {
      margin-left: auto;
      padding: 0.3rem 0.8rem;
      background: #e53935;
      color: white;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.85rem;
    }
    .blocks-remaining {
      display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem;
      margin-bottom: 1.5rem;
    }
    .block-chip {
      background: #1976d2; color: white;
      padding: 0.2rem 0.6rem; border-radius: 4px;
      font-size: 0.85rem; font-family: monospace;
    }
    .status { color: #666; }
    h3 { margin: 0 0 0.75rem; font-size: 1rem; color: #444; }
    .word-list { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem; }
    .word-btn {
      display: flex; flex-direction: column; align-items: flex-start;
      padding: 0.5rem 0.75rem;
      border: 2px solid #1976d2; background: white;
      border-radius: 8px; cursor: pointer;
      transition: background 0.15s;
    }
    .word-btn:hover { background: #e3f2fd; }
    .word { font-weight: 700; font-size: 1rem; margin-bottom: 0.25rem; }
    .blocks { display: flex; gap: 0.25rem; flex-wrap: wrap; }
    .mini-chip {
      background: #1976d2; color: white;
      padding: 0.1rem 0.4rem; border-radius: 3px;
      font-size: 0.7rem; font-family: monospace;
    }
    .final {
      background: #e8f5e9; border: 2px solid #388e3c;
      border-radius: 8px; padding: 0.75rem 1rem;
      font-size: 1.1rem;
    }
  `],
})
export class PhraseBuilder implements OnInit {
  private readonly service = inject(BlocksService);

  remainingBlocks = signal<string[]>([...ALL_BLOCKS]);
  phraseWords = signal<string[]>([]);
  availableWords = signal<WordResult[]>([]);
  loading = signal(false);

  ngOnInit() {
    this.loadWords();
  }

  private loadWords() {
    this.loading.set(true);
    this.service.getBuilderWords(this.remainingBlocks()).subscribe({
      next: state => {
        this.availableWords.set(state.availableWords);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  pickWord(item: WordResult) {
    this.phraseWords.update(w => [...w, item.word]);
    this.remainingBlocks.update(rb => {
      const updated = [...rb];
      for (const block of item.blocks) {
        const idx = updated.indexOf(block);
        if (idx !== -1) updated.splice(idx, 1);
      }
      return updated;
    });
    this.loadWords();
  }

  reset() {
    this.remainingBlocks.set([...ALL_BLOCKS]);
    this.phraseWords.set([]);
    this.loadWords();
  }
}
