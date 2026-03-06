import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { WordFinder } from './word-finder';

describe('WordFinder', () => {
  let component: WordFinder;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(WordFinder);
    component = fixture.componentInstance;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts with default state', () => {
    expect(component.commonOnly()).toBe(true);
    expect(component.loading()).toBe(false);
    expect(component.error()).toBeNull();
    expect(component.searched()).toBe(false);
    expect(component.totalWords()).toBe(0);
  });

  describe('search', () => {
    it('sets loading and fetches words', () => {
      component.search();
      expect(component.loading()).toBe(true);

      const req = httpMock.expectOne(r => r.url.includes('/builder/words'));
      req.flush({
        availableWords: [
          { word: 'by', blocks: ['bozt', 'yljdr'], numBlocks: 2 },
          { word: 'no', blocks: ['cpn', 'jwo'], numBlocks: 2 },
        ],
      });

      expect(component.loading()).toBe(false);
      expect(component.searched()).toBe(true);
      expect(component.totalWords()).toBe(2);
    });

    it('handles error', () => {
      component.search();
      const req = httpMock.expectOne(r => r.url.includes('/words'));
      req.error(new ProgressEvent('error'));

      expect(component.loading()).toBe(false);
      expect(component.error()).toBe('Failed to find words.');
    });
  });

  describe('computed properties', () => {
    it('wordGroups sorted by numBlocks', () => {
      component.search();
      httpMock.expectOne(r => r.url.includes('/builder/words')).flush({
        availableWords: [
          { word: 'cat', blocks: ['c', 'a', 't'], numBlocks: 3 },
          { word: 'at', blocks: ['a', 't'], numBlocks: 2 },
        ],
      });

      const groups = component.wordGroups();
      expect(groups[0].numBlocks).toBe(2);
      expect(groups[1].numBlocks).toBe(3);
    });
  });
});
