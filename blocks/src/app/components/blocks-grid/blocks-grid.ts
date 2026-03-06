import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BlocksService } from '../../services/blocks.service';
import { BlockConfigService, BlockPreset } from '../../services/block-config.service';
import { Block } from '../../models/blocks.models';

@Component({
  selector: 'app-blocks-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  template: `
    <div class="blocks-page">
      <h2>Available Blocks</h2>

      <div class="config-panel">
        <div class="preset-row">
          <label class="radio-label">
            <input type="radio" name="preset" value="standard"
              [ngModel]="blockConfig.preset()"
              (ngModelChange)="onPresetChange($event)" />
            Standard
          </label>
          <label class="radio-label">
            <input type="radio" name="preset" value="goodonly"
              [ngModel]="blockConfig.preset()"
              (ngModelChange)="onPresetChange($event)" />
            Good Only
          </label>
          <label class="radio-label">
            <input type="radio" name="preset" value="custom"
              [ngModel]="blockConfig.preset()"
              (ngModelChange)="onPresetChange($event)" />
            Custom
          </label>
        </div>

        @if (blockConfig.preset() === 'custom') {
          <div class="custom-area">
            <textarea
              class="custom-input"
              rows="4"
              placeholder="One block per line, e.g.&#10;mwja&#10;bozt&#10;hujiv"
              [ngModel]="customText()"
              (ngModelChange)="customText.set($event)"
            ></textarea>
            <button class="apply-btn" (click)="applyCustom()">Apply</button>
          </div>
        }
      </div>

      @if (loading()) {
        <p class="status">Loading blocks...</p>
      } @else if (error()) {
        <p class="status error">{{ error() }}</p>
      } @else {
        <p class="summary">{{ blocks().length }} blocks &bull; {{ totalLetters() }} total letters</p>
        <div class="grid">
          @for (block of blocks(); track block.letters) {
            <div class="block-card">
              <div class="block-letters">
                @for (letter of block.letters.split(''); track $index) {
                  <span class="letter">{{ letter.toUpperCase() }}</span>
                }
              </div>
              <div class="block-label">{{ block.letters }}</div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .blocks-page { padding: 1.5rem; }
    h2 { margin: 0 0 0.75rem; }
    .config-panel {
      background: #f5f5f5; border-radius: 8px;
      padding: 0.75rem 1rem; margin-bottom: 1.5rem;
    }
    .preset-row { display: flex; gap: 1.5rem; flex-wrap: wrap; }
    .radio-label {
      display: flex; align-items: center; gap: 0.4rem;
      font-size: 0.9rem; cursor: pointer;
    }
    .custom-area { display: flex; gap: 0.75rem; align-items: flex-start; margin-top: 0.75rem; }
    .custom-input {
      flex: 1; padding: 0.5rem; border: 1px solid #ccc;
      border-radius: 6px; font-family: monospace; font-size: 0.9rem; resize: vertical;
    }
    .apply-btn {
      padding: 0.4rem 1rem; background: #1976d2; color: white;
      border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem;
    }
    .apply-btn:hover { background: #1565c0; }
    .summary { color: #666; margin-bottom: 1.5rem; }
    .status { color: #666; }
    .error { color: #d32f2f; }
    .grid { display: flex; flex-wrap: wrap; gap: 1rem; }
    .block-card {
      border: 2px solid #1976d2; border-radius: 8px;
      padding: 0.75rem 1rem; text-align: center; min-width: 80px;
    }
    .block-letters { display: flex; gap: 4px; justify-content: center; margin-bottom: 0.4rem; }
    .letter {
      font-size: 1.2rem; font-weight: 700; color: #1976d2;
      background: #e3f2fd; border-radius: 4px;
      width: 1.6rem; height: 1.6rem;
      display: flex; align-items: center; justify-content: center;
    }
    .block-label { font-size: 0.75rem; color: #888; }
  `],
})
export class BlocksGrid {
  private readonly service = inject(BlocksService);
  readonly blockConfig = inject(BlockConfigService);

  blocks = signal<Block[]>([]);
  totalLetters = signal(0);
  loading = signal(false);
  error = signal<string | null>(null);
  customText = signal('');

  constructor() {
    effect(() => {
      // Re-load whenever the active block set changes
      this.blockConfig.blocks();
      this.loadBlocks();
    });
  }

  onPresetChange(preset: BlockPreset) {
    if (preset !== 'custom') {
      this.blockConfig.usePreset(preset);
    } else {
      this.blockConfig.preset.set('custom');
    }
  }

  applyCustom() {
    this.blockConfig.useCustom(this.customText());
  }

  private loadBlocks() {
    this.loading.set(true);
    this.service.getBlocks().subscribe({
      next: info => {
        this.blocks.set(info.blocks);
        this.totalLetters.set(info.totalLetters);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load blocks.');
        this.loading.set(false);
      },
    });
  }
}
