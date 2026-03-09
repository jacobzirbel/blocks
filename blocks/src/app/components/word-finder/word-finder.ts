import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { BlockConfigService } from '../../services/block-config.service';
import { BlockMatcherService } from '../../core/block-matcher.service';
import { WordResult } from '../../models/blocks.models';

@Component({
  selector: 'app-word-finder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './word-finder.html',
  styleUrl: './word-finder.css',
})
export class WordFinder {
  private readonly matcher = inject(BlockMatcherService);
  readonly blockConfig = inject(BlockConfigService);

  commonOnly = signal(true);
  loading = signal(false);
  error = signal<string | null>(null);
  searched = signal(false);

  private rawResults = signal<WordResult[]>([]);

  totalWords = computed(() => this.rawResults().length);

  wordGroups = computed(() => {
    const grouped = new Map<number, WordResult[]>();
    for (const w of this.rawResults()) {
      const arr = grouped.get(w.numBlocks) ?? [];
      arr.push(w);
      grouped.set(w.numBlocks, arr);
    }
    return [...grouped.entries()]
      .map(([numBlocks, words]) => ({ numBlocks, words }))
      .sort((a, b) => a.numBlocks - b.numBlocks);
  });

  async search() {
    this.loading.set(true);
    this.error.set(null);
    try {
      const results = await this.matcher.findAvailableWords([], this.blockConfig.blocks(), this.commonOnly());
      this.rawResults.set(results);
      this.searched.set(true);
    } catch {
      this.error.set('Failed to find words.');
    } finally {
      this.loading.set(false);
    }
  }
}
