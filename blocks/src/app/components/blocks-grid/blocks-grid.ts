import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { BlocksService } from '../../services/blocks.service';
import { Block } from '../../models/blocks.models';

@Component({
  selector: 'app-blocks-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="blocks-page">
      <h2>Available Blocks</h2>

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
    h2 { margin: 0 0 0.5rem; }
    .summary { color: #666; margin-bottom: 1.5rem; }
    .status { color: #666; }
    .error { color: #d32f2f; }
    .grid {
      display: flex;
      flex-wrap: wrap;
      gap: 1rem;
    }
    .block-card {
      border: 2px solid #1976d2;
      border-radius: 8px;
      padding: 0.75rem 1rem;
      text-align: center;
      min-width: 80px;
    }
    .block-letters {
      display: flex;
      gap: 4px;
      justify-content: center;
      margin-bottom: 0.4rem;
    }
    .letter {
      font-size: 1.2rem;
      font-weight: 700;
      color: #1976d2;
      background: #e3f2fd;
      border-radius: 4px;
      width: 1.6rem;
      height: 1.6rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .block-label { font-size: 0.75rem; color: #888; }
  `],
})
export class BlocksGrid implements OnInit {
  private readonly service = inject(BlocksService);

  blocks = signal<Block[]>([]);
  totalLetters = signal(0);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit() {
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
