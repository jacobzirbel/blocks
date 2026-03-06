import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BlocksService } from '../../services/blocks.service';
import { BlockConfigService } from '../../services/block-config.service';
import { WordsByBlockCount, WordResult } from '../../models/blocks.models';

@Component({
  selector: 'app-word-finder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './word-finder.html',
  styleUrl: './word-finder.css',
})
export class WordFinder {
  private readonly service = inject(BlocksService);
  readonly blockConfig = inject(BlockConfigService);

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
    this.service.findWords(this.commonOnly(), this.blockConfig.blocks()).subscribe({
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
