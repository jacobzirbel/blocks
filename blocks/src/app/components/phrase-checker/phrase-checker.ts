import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BlockConfigService } from '../../services/block-config.service';
import { canFormWithBlocks, computeMissingLetters } from '../../core/block-matcher';
import { PhraseCheckResult } from '../../models/blocks.models';

@Component({
  selector: 'app-phrase-checker',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phrase-checker.html',
  styleUrl: './phrase-checker.css',
})
export class PhraseChecker {
  private readonly blockConfig = inject(BlockConfigService);

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

    const blocks = this.blockConfig.blocks();
    const clean = p.replace(/\s/g, '').toLowerCase();
    const { matched, usedIndices } = canFormWithBlocks(clean, blocks);
    const blocksUsed = [...usedIndices].map(i => blocks[i]);

    const missingLetters: Record<string, number> = matched
      ? {}
      : computeMissingLetters(
          [...clean].reduce((acc, ch) => { acc[ch] = (acc[ch] ?? 0) + 1; return acc; }, {} as Record<string, number>),
          blocks
        );

    this.result.set({ phrase: p, canForm: matched, blocksUsed, missingLetters });
    this.loading.set(false);
  }
}
