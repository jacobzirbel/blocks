import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PhraseBuilder } from './phrase-builder';
import { BlockConfigService } from '../../services/block-config.service';

describe('PhraseBuilder', () => {
  let component: PhraseBuilder;
  let httpMock: HttpTestingController;
  let configService: BlockConfigService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    configService = TestBed.inject(BlockConfigService);
    const fixture = TestBed.createComponent(PhraseBuilder);
    component = fixture.componentInstance;
  });

  function flushInitialLoad() {
    const req = httpMock.expectOne('http://localhost:8000/builder/words');
    req.flush({
      remainingBlocks: [],
      phraseWords: [],
      availableWords: [
        { word: 'by', blocks: ['bozt', 'yljdr'], numBlocks: 2 },
        { word: 'no', blocks: ['cpn', 'jwo'], numBlocks: 2 },
      ],
    });
  }

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should create and load words on init', () => {
    flushInitialLoad();
    expect(component).toBeTruthy();
    expect(component.availableWords().length).toBe(2);
    expect(component.loading()).toBe(false);
  });

  describe('pickWord', () => {
    it('adds word to phrase and reloads', () => {
      flushInitialLoad();
      const item = { word: 'by', blocks: ['bozt', 'yljdr'], numBlocks: 2 };
      component.pickWord(item);

      expect(component.phraseWords()).toEqual(['by']);
      expect(component.searchTerm()).toBe('');

      // Should trigger another load
      const req = httpMock.expectOne('http://localhost:8000/builder/words');
      expect(req.request.body.chosen_words).toEqual(['by']);
      req.flush({ remainingBlocks: [], phraseWords: ['by'], availableWords: [] });
    });
  });

  describe('filteredWords', () => {
    it('filters by search term', () => {
      flushInitialLoad();
      component.searchTerm.set('by');
      const filtered = component.filteredWords();
      expect(filtered.every(w => w.word.includes('by'))).toBe(true);
    });

    it('sorts by word length then alphabetically', () => {
      flushInitialLoad();
      const words = component.filteredWords();
      for (let i = 1; i < words.length; i++) {
        const prev = words[i - 1];
        const curr = words[i];
        expect(prev.word.length <= curr.word.length || prev.word <= curr.word).toBe(true);
      }
    });
  });

  describe('addCustomWord', () => {
    it('does nothing for empty input', () => {
      flushInitialLoad();
      component.customWord.set('');
      component.addCustomWord();
      httpMock.expectNone('http://localhost:8000/builder/check');
    });

    it('adds valid custom word', () => {
      flushInitialLoad();
      component.customWord.set('test');
      component.addCustomWord();

      expect(component.checkingCustomWord()).toBe(true);

      const req = httpMock.expectOne('http://localhost:8000/builder/check');
      req.flush({ canForm: true, blocksUsed: [] });

      expect(component.checkingCustomWord()).toBe(false);
      expect(component.phraseWords()).toEqual(['test']);
      expect(component.customWord()).toBe('');

      // Reloads words after adding
      httpMock.expectOne('http://localhost:8000/builder/words').flush({
        remainingBlocks: [], phraseWords: ['test'], availableWords: [],
      });
    });

    it('shows error for invalid custom word', () => {
      flushInitialLoad();
      component.customWord.set('zzz');
      component.addCustomWord();

      httpMock.expectOne('http://localhost:8000/builder/check').flush({
        canForm: false, blocksUsed: [],
      });

      expect(component.customWordError()).toContain('cannot be formed');
      expect(component.phraseWords()).toEqual([]);
    });

    it('handles API error', () => {
      flushInitialLoad();
      component.customWord.set('test');
      component.addCustomWord();

      httpMock.expectOne('http://localhost:8000/builder/check').error(new ProgressEvent('error'));

      expect(component.checkingCustomWord()).toBe(false);
      expect(component.customWordError()).toBe('Error checking word.');
    });
  });

  describe('reset', () => {
    it('resets all state and reloads', () => {
      flushInitialLoad();
      component.phraseWords.set(['word1']);
      component.searchTerm.set('search');
      component.customWord.set('custom');
      component.customWordError.set('err');
      component.loadError.set('err');

      component.reset();

      expect(component.phraseWords()).toEqual([]);
      expect(component.searchTerm()).toBe('');
      expect(component.customWord()).toBe('');
      expect(component.customWordError()).toBeNull();
      expect(component.loadError()).toBeNull();

      // Should reload
      httpMock.expectOne('http://localhost:8000/builder/words').flush({
        remainingBlocks: [], phraseWords: [], availableWords: [],
      });
    });
  });

  describe('phraseBlockDisplay', () => {
    it('returns empty for no words', () => {
      flushInitialLoad();
      expect(component.phraseBlockDisplay()).toEqual([]);
    });

    it('assigns blocks without reuse across words', () => {
      flushInitialLoad();
      // Pick two words that share block letters
      component.phraseWords.set(['by', 'no']);
      const display = component.phraseBlockDisplay();
      expect(display).toHaveLength(2);

      // Collect all blocks used across all words
      const allUsedBlocks = display.flatMap(d => d.blockAssignments.map(a => a.block));
      const unique = new Set(allUsedBlocks);
      expect(unique.size).toBe(allUsedBlocks.length); // no duplicates
    });
  });

  describe('error handling', () => {
    it('handles timeout (408) with specific message', () => {
      // Initial load triggers, make it fail with 408
      const req = httpMock.expectOne('http://localhost:8000/builder/words');
      req.flush('timeout', { status: 408, statusText: 'Timeout' });

      expect(component.loadError()).toContain('timed out');
      expect(component.loading()).toBe(false);
    });

    it('handles generic error', () => {
      const req = httpMock.expectOne('http://localhost:8000/builder/words');
      req.flush('error', { status: 500, statusText: 'Server Error' });

      expect(component.loadError()).toContain('Failed to load');
      expect(component.loading()).toBe(false);
    });
  });
});
