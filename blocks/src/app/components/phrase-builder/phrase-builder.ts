import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BlocksService } from '../../services/blocks.service';
import { BlockConfigService } from '../../services/block-config.service';
import { WordResult } from '../../models/blocks.models';


@Component({
  selector: 'app-phrase-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
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
        <span class="label">Blocks:</span>
        @for (b of allBlocks(); track $index) {
          <span class="block-chip">{{ b }}</span>
        }
      </div>

      @if (loading()) {
        <p class="status">Finding words...</p>
      } @else if (availableWords().length === 0) {
        <p class="status">No more words can be formed with remaining blocks.</p>
      } @else {
        <div class="controls-bar">
          <input
            class="search-input"
            type="search"
            placeholder="Search words…"
            [ngModel]="searchTerm()"
            (ngModelChange)="searchTerm.set($event)"
          />
          <label class="toggle-label">
            <input type="checkbox" [(ngModel)]="commonOnly" (ngModelChange)="onCommonOnlyChange()" />
            Common words only
          </label>
          <span class="count">
            {{ filteredWords().length }} / {{ availableWords().length }} words
          </span>
        </div>
        @if (filteredWords().length === 0) {
          <p class="status">No words match your search.</p>
        } @else {
          <div class="word-list">
            @for (item of filteredWords(); track item.word) {
              <button class="word-btn" (click)="pickWord(item)">{{ item.word }}</button>
            }
          </div>
        }
      }

      <div class="custom-word-bar">
        <input
          class="custom-word-input"
          type="text"
          placeholder="Enter any word (e.g. a proper noun)…"
          [ngModel]="customWord()"
          (ngModelChange)="customWord.set($event)"
          (keydown.enter)="addCustomWord()"
          [disabled]="checkingCustomWord()"
        />
        <button class="add-btn" (click)="addCustomWord()" [disabled]="!customWord().trim() || checkingCustomWord()">
          Add
        </button>
        @if (customWordError()) {
          <span class="custom-error">{{ customWordError() }}</span>
        }
      </div>

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
      margin-left: auto; padding: 0.3rem 0.8rem;
      background: #e53935; color: white; border: none;
      border-radius: 6px; cursor: pointer; font-size: 0.85rem;
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
    .assignment-panel {
      background: #fff8e1; border: 2px solid #f9a825;
      border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;
    }
    .assignment-header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 0.75rem;
    }
    .cancel-btn {
      padding: 0.2rem 0.6rem; background: none; border: 1px solid #999;
      border-radius: 4px; cursor: pointer; font-size: 0.8rem; color: #555;
    }
    .assignment-rows { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem; }
    .assignment-row { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
    .letter-badge {
      font-weight: 700; font-size: 1rem; min-width: 1.4rem; text-align: center;
      background: #e0e0e0; border-radius: 4px; padding: 0.1rem 0.3rem;
    }
    .block-chosen {
      background: #1976d2; color: white; border: 2px solid #1976d2;
      border-radius: 6px; padding: 0.25rem 0.6rem;
      font-family: monospace; font-size: 0.9rem; cursor: default;
    }
    .block-alt {
      background: white; color: #1976d2; border: 2px solid #1976d2;
      border-radius: 6px; padding: 0.25rem 0.6rem;
      font-family: monospace; font-size: 0.9rem; cursor: pointer;
      transition: background 0.1s;
    }
    .block-alt:hover { background: #e3f2fd; }
    .confirm-btn {
      padding: 0.4rem 1.2rem; background: #f9a825; color: white;
      border: none; border-radius: 6px; cursor: pointer;
      font-size: 0.95rem; font-weight: 600;
    }
    .confirm-btn:hover { background: #f57f17; }
    .controls-bar {
      display: flex; align-items: center; gap: 1rem;
      margin-bottom: 0.75rem; flex-wrap: wrap;
    }
    .search-input {
      padding: 0.4rem 0.75rem;
      border: 1px solid #ccc; border-radius: 6px;
      font-size: 0.95rem; width: 220px;
    }
    .toggle-label {
      display: flex; align-items: center; gap: 0.4rem;
      font-size: 0.9rem; cursor: pointer;
    }
    .count { font-size: 0.85rem; color: #666; margin-left: auto; }
    .status { color: #666; }
    .word-list { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem; }
    .word-btn {
      padding: 0.5rem 0.75rem;
      border: 2px solid #1976d2; background: white;
      border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 1rem;
      transition: background 0.15s;
    }
    .word-btn:hover { background: #e3f2fd; }
    .custom-word-bar {
      display: flex; align-items: center; gap: 0.5rem;
      margin-bottom: 1.5rem; flex-wrap: wrap;
    }
    .custom-word-input {
      padding: 0.4rem 0.75rem; border: 1px solid #ccc;
      border-radius: 6px; font-size: 0.95rem; width: 260px;
    }
    .add-btn {
      padding: 0.4rem 1rem; background: #388e3c; color: white;
      border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem;
    }
    .add-btn:disabled { background: #aaa; cursor: default; }
    .custom-error { color: #d32f2f; font-size: 0.85rem; }
    .final {
      background: #e8f5e9; border: 2px solid #388e3c;
      border-radius: 8px; padding: 0.75rem 1rem; font-size: 1.1rem;
    }
  `],
})
export class PhraseBuilder {
  private readonly service = inject(BlocksService);
  private readonly blockConfig = inject(BlockConfigService);

  allBlocks = signal<string[]>([...this.blockConfig.blocks()]);
  phraseWords = signal<string[]>([]);
  availableWords = signal<WordResult[]>([]);
  loading = signal(false);
  searchTerm = signal('');
  commonOnly = true;
  customWord = signal('');
  customWordError = signal<string | null>(null);
  checkingCustomWord = signal(false);

  filteredWords = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    if (!term) return this.availableWords();
    return this.availableWords().filter(w => w.word.includes(term));
  });

  constructor() {
    this.loadWords();
  }

  onCommonOnlyChange() {
    this.loadWords();
  }

  private loadWords() {
    this.loading.set(true);
    this.service.getBuilderWords(this.allBlocks(), this.phraseWords(), this.commonOnly).subscribe({
      next: state => {
        this.availableWords.set(state.availableWords);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  pickWord(item: WordResult) {
    this.phraseWords.update(w => [...w, item.word]);
    this.searchTerm.set('');
    this.loadWords();
  }

  addCustomWord() {
    const word = this.customWord().trim();
    if (!word) return;

    this.checkingCustomWord.set(true);
    this.customWordError.set(null);

    this.service.checkBuilderWord(word, this.allBlocks(), this.phraseWords()).subscribe({
      next: result => {
        this.checkingCustomWord.set(false);
        if (result.canForm) {
          this.phraseWords.update(w => [...w, word.toLowerCase()]);
          this.customWord.set('');
          this.loadWords();
        } else {
          this.customWordError.set(`"${word}" cannot be formed with the remaining blocks.`);
        }
      },
      error: () => {
        this.checkingCustomWord.set(false);
        this.customWordError.set('Error checking word.');
      },
    });
  }

  reset() {
    this.allBlocks.set([...this.blockConfig.blocks()]);
    this.phraseWords.set([]);
    this.searchTerm.set('');
    this.customWord.set('');
    this.customWordError.set(null);
    this.loadWords();
  }
}
