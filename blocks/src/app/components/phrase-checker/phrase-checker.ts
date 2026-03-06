import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BlocksService } from '../../services/blocks.service';
import { PhraseCheckResult } from '../../models/blocks.models';

@Component({
  selector: 'app-phrase-checker',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="checker-page">
      <h2>Check a Phrase</h2>
      <p class="hint">Enter a word or phrase to see if it can be spelled using the available blocks.</p>

      <div class="input-row">
        <input
          type="text"
          [(ngModel)]="phrase"
          placeholder="e.g. hello world"
          (keydown.enter)="check()"
          [disabled]="loading()"
        />
        <button (click)="check()" [disabled]="!phrase.trim() || loading()">
          {{ loading() ? 'Checking...' : 'Check' }}
        </button>
      </div>

      @if (result()) {
        <div class="result" [class.success]="result()!.canForm" [class.fail]="!result()!.canForm">
          <div class="result-header">
            <span class="icon">{{ result()!.canForm ? '✓' : '✗' }}</span>
            <strong>"{{ result()!.phrase }}"</strong>
            {{ result()!.canForm ? 'can be formed!' : 'cannot be formed.' }}
          </div>

          @if (result()!.canForm && result()!.blocksUsed.length) {
            <div class="blocks-used">
              <span class="label">Blocks used:</span>
              @for (block of result()!.blocksUsed; track block) {
                <span class="block-chip">{{ block }}</span>
              }
            </div>
          }

          @if (!result()!.canForm && result()!.missingLetters) {
            <div class="missing">
              <span class="label">Missing letters:</span>
              @for (entry of missingEntries(); track entry.letter) {
                <span class="missing-chip">{{ entry.letter }} ×{{ entry.count }}</span>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .checker-page { padding: 1.5rem; }
    h2 { margin: 0 0 0.5rem; }
    .hint { color: #666; margin-bottom: 1.5rem; }
    .input-row { display: flex; gap: 0.75rem; margin-bottom: 1.5rem; }
    input {
      flex: 1;
      padding: 0.6rem 0.8rem;
      font-size: 1rem;
      border: 1px solid #ccc;
      border-radius: 6px;
      outline: none;
    }
    input:focus { border-color: #1976d2; }
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
    .result {
      border-radius: 8px;
      padding: 1rem 1.25rem;
      border: 2px solid;
    }
    .result.success { border-color: #388e3c; background: #f1f8e9; }
    .result.fail { border-color: #d32f2f; background: #ffebee; }
    .result-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
    .icon { font-size: 1.3rem; }
    .blocks-used, .missing { display: flex; align-items: center; flex-wrap: wrap; gap: 0.5rem; }
    .label { font-size: 0.85rem; color: #555; }
    .block-chip {
      background: #1976d2;
      color: white;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      font-size: 0.85rem;
      font-family: monospace;
    }
    .missing-chip {
      background: #d32f2f;
      color: white;
      padding: 0.2rem 0.6rem;
      border-radius: 4px;
      font-size: 0.85rem;
    }
  `],
})
export class PhraseChecker {
  private readonly service = inject(BlocksService);

  phrase = '';
  loading = signal(false);
  result = signal<PhraseCheckResult | null>(null);

  missingEntries() {
    const missing = this.result()?.missingLetters ?? {};
    return Object.entries(missing).map(([letter, count]) => ({ letter, count }));
  }

  check() {
    const p = this.phrase.trim();
    if (!p) return;
    this.loading.set(true);
    this.result.set(null);
    this.service.checkPhrase(p).subscribe({
      next: r => {
        this.result.set(r);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
