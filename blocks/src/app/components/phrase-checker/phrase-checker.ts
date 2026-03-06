import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BlocksService } from '../../services/blocks.service';
import { PhraseCheckResult } from '../../models/blocks.models';

@Component({
  selector: 'app-phrase-checker',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './phrase-checker.html',
  styleUrl: './phrase-checker.css',
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
