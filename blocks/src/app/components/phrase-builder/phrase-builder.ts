import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BlockConfigService } from '../../services/block-config.service';
import { BlockMatcherService } from '../../core/block-matcher.service';
import { canFormWithBlocks } from '../../core/block-matcher';
import { WordResult } from '../../core/block-matcher';

@Component({
  selector: 'app-phrase-builder',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './phrase-builder.html',
  styleUrl: './phrase-builder.css',
})
export class PhraseBuilder {
  private readonly matcher = inject(BlockMatcherService);
  private readonly blockConfig = inject(BlockConfigService);

  allBlocks = signal<string[]>([]);
  phraseWords = signal<string[]>([]);
  availableWords = signal<WordResult[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);
  searchTerm = signal('');
  commonOnly = true;
  customWord = signal('');
  customWordError = signal<string | null>(null);
  checkingCustomWord = signal(false);

  /** Indices of blocks consumed by the current phrase. */
  usedBlockIndices = computed(() => {
    if (this.phraseWords().length === 0) return new Set<number>();
    const phrase = this.phraseWords().join('');
    return canFormWithBlocks(phrase, this.allBlocks()).usedIndices;
  });

  filteredWords = computed(() => {
    const term = this.searchTerm().toLowerCase().trim();
    const words = term
      ? this.availableWords().filter(w => w.word.includes(term))
      : this.availableWords();
    return [...words].sort((a, b) => a.word.length - b.word.length || a.word.localeCompare(b.word));
  });

  phraseBlockDisplay = computed(() => {
    const words = this.phraseWords();
    const blocks = this.allBlocks();
    if (words.length === 0) return [];

    type Tagged = { letter: string; wordIdx: number; posInWord: number; origIdx: number };
    const tagged: Tagged[] = [];
    for (let w = 0; w < words.length; w++) {
      for (let i = 0; i < words[w].length; i++) {
        tagged.push({ letter: words[w][i], wordIdx: w, posInWord: i, origIdx: tagged.length });
      }
    }

    const sorted = [...tagged].sort(
      (a, b) =>
        blocks.filter(bl => bl.includes(a.letter)).length -
        blocks.filter(bl => bl.includes(b.letter)).length
    );

    const used = new Set<number>();
    const sortedToBlock = new Map<number, number>();

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

    const origToBlock = new Map<number, number>();
    sorted.forEach((t, si) => origToBlock.set(t.origIdx, sortedToBlock.get(si)!));

    return words.map((word, wi) => {
      const wordBlocks = tagged
        .filter(t => t.wordIdx === wi)
        .sort((a, b) => a.posInWord - b.posInWord)
        .map(t => ({ block: blocks[origToBlock.get(t.origIdx)!], usedLetter: t.letter }));
      return { word, blockAssignments: wordBlocks };
    });
  });

  constructor() {
    // Reset and reload whenever the block config changes
    effect(() => {
      const blocks = this.blockConfig.blocks();
      untracked(() => {
        this.allBlocks.set([...blocks]);
        this.phraseWords.set([]);
        this.searchTerm.set('');
        this.customWord.set('');
        this.customWordError.set(null);
        this.loadError.set(null);
        this.loadWords();
      });
    });
  }

  onCommonOnlyChange() {
    this.loadWords();
  }

  private async loadWords() {
    this.loading.set(true);
    this.loadError.set(null);
    try {
      const words = await this.matcher.findAvailableWords(
        this.phraseWords(),
        this.allBlocks(),
        this.commonOnly
      );
      this.availableWords.set(words);
    } catch {
      this.loadError.set('Failed to load words. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  pickWord(item: WordResult) {
    this.phraseWords.update(w => [...w, item.word]);
    this.searchTerm.set('');
    this.loadWords();
  }

  async addCustomWord() {
    const word = this.customWord().trim();
    if (!word) return;

    this.checkingCustomWord.set(true);
    this.customWordError.set(null);

    try {
      const canForm = await this.matcher.checkWord(word, this.phraseWords(), this.allBlocks());
      if (canForm) {
        this.phraseWords.update(w => [...w, word.toLowerCase()]);
        this.customWord.set('');
        this.loadWords();
      } else {
        this.customWordError.set(`"${word}" cannot be formed with the remaining blocks.`);
      }
    } catch {
      this.customWordError.set('Error checking word.');
    } finally {
      this.checkingCustomWord.set(false);
    }
  }

  reset() {
    this.phraseWords.set([]);
    this.searchTerm.set('');
    this.customWord.set('');
    this.customWordError.set(null);
    this.loadError.set(null);
    this.loadWords();
  }
}
