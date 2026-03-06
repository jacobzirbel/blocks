import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EMPTY, Subject } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { BlocksService } from '../../services/blocks.service';
import { BlockConfigService } from '../../services/block-config.service';
import { WordResult } from '../../models/blocks.models';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-phrase-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './phrase-builder.html',
  styleUrl: './phrase-builder.css',
})
export class PhraseBuilder {
  private readonly service = inject(BlocksService);
  private readonly blockConfig = inject(BlockConfigService);

  allBlocks = signal<string[]>([...this.blockConfig.blocks()]);
  phraseWords = signal<string[]>([]);
  availableWords = signal<WordResult[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);
  searchTerm = signal('');
  commonOnly = true;
  customWord = signal('');
  customWordError = signal<string | null>(null);
  checkingCustomWord = signal(false);

  private readonly loadTrigger = new Subject<void>();

  filteredWords = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const words = term
      ? this.availableWords().filter(w => w.word.includes(term))
      : this.availableWords();
    return [...words].sort((a, b) => a.word.length - b.word.length || a.word.localeCompare(b.word));
  });

  /**
   * Derives block assignments for the entire phrase simultaneously (no block
   * reuse across words). Blocks within each word are returned in letter order.
   */
  phraseBlockDisplay = computed(() => {
    const words = this.phraseWords();
    const blocks = this.allBlocks();
    if (words.length === 0) return [];

    // Tag each letter with its word index and position within the word
    type Tagged = { letter: string; wordIdx: number; posInWord: number; origIdx: number };
    const tagged: Tagged[] = [];
    for (let w = 0; w < words.length; w++) {
      for (let i = 0; i < words[w].length; i++) {
        tagged.push({ letter: words[w][i], wordIdx: w, posInWord: i, origIdx: tagged.length });
      }
    }

    // Sort by constraint (fewest matching blocks first) for better matching
    const sorted = [...tagged].sort(
      (a, b) =>
        blocks.filter(bl => bl.includes(a.letter)).length -
        blocks.filter(bl => bl.includes(b.letter)).length
    );

    const used = new Set<number>();
    const sortedToBlock = new Map<number, number>(); // sorted position -> block index

    function backtrack(si: number): boolean {
      if (si === sorted.length) return true;
      const letter = sorted[si].letter;
      for (let bi = 0; bi < blocks.length; bi++) {
        if (!used.has(bi) && blocks[bi].includes(letter)) {
          used.add(bi);
          sortedToBlock.set(si, bi);
          if (backtrack(si + 1)) return true;
          used.delete(bi);
          sortedToBlock.delete(si);
        }
      }
      return false;
    }

    if (!backtrack(0)) return words.map(word => ({ word, blockAssignments: [] }));

    // Map original tag index -> block index
    const origToBlock = new Map<number, number>();
    sorted.forEach((t, si) => origToBlock.set(t.origIdx, sortedToBlock.get(si)!));

    // Group by word, sorted by posInWord so blocks appear in letter order
    return words.map((word, wi) => {
      const wordBlocks = tagged
        .filter(t => t.wordIdx === wi)
        .sort((a, b) => a.posInWord - b.posInWord)
        .map(t => ({ block: blocks[origToBlock.get(t.origIdx)!], usedLetter: t.letter }));
      return { word, blockAssignments: wordBlocks };
    });
  });

  constructor() {
    this.loadTrigger.pipe(
      switchMap(() => {
        this.loading.set(true);
        this.loadError.set(null);
        return this.service.getBuilderWords(this.allBlocks(), this.phraseWords(), this.commonOnly).pipe(
          catchError((err: { status?: number }) => {
            this.loading.set(false);
            this.loadError.set(
              err.status === 408
                ? 'Word search timed out. Try reducing the number of blocks.'
                : 'Failed to load words. Please try again.'
            );
            return EMPTY;
          }),
        );
      }),
      takeUntilDestroyed(),
    ).subscribe(state => {
      this.availableWords.set(state.availableWords);
      this.loading.set(false);
    });
    this.loadWords();
  }

  onCommonOnlyChange() {
    this.loadWords();
  }

  private loadWords() {
    this.loadTrigger.next();
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
          const lower = word.toLowerCase();
          this.phraseWords.update(w => [...w, lower]);
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
    this.loadError.set(null);
    this.loadWords();
  }
}
