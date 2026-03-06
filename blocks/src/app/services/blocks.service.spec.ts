import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { BlocksService } from './blocks.service';
import { BlockConfigService } from './block-config.service';

describe('BlocksService', () => {
  let service: BlocksService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(BlocksService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getBlocks', () => {
    it('calls GET /blocks', () => {
      const mockResponse = {
        blocks: [{ letters: 'ab' }, { letters: 'cd' }],
        totalLetters: 4,
      };
      service.getBlocks().subscribe(data => {
        expect(data.blocks).toHaveLength(2);
        expect(data.totalLetters).toBe(4);
      });
      const req = httpMock.expectOne('http://localhost:8000/blocks');
      expect(req.request.method).toBe('GET');
      req.flush(mockResponse);
    });
  });

  describe('checkPhrase', () => {
    it('calls POST /check with phrase', () => {
      const mockResult = {
        phrase: 'hello',
        canForm: true,
        blocksUsed: ['h', 'e', 'l'],
        missingLetters: {},
      };
      service.checkPhrase('hello').subscribe(result => {
        expect(result.canForm).toBe(true);
        expect(result.phrase).toBe('hello');
      });
      const req = httpMock.expectOne('http://localhost:8000/check');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual({ phrase: 'hello' });
      req.flush(mockResult);
    });
  });

  describe('findWords', () => {
    it('calls GET /words when no custom blocks', () => {
      service.findWords(true).subscribe();
      const req = httpMock.expectOne(r => r.url === 'http://localhost:8000/words');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('common_only')).toBe('true');
      req.flush({});
    });

    it('calls POST /builder/words when custom blocks provided', () => {
      service.findWords(true, ['a', 'b']).subscribe();
      const req = httpMock.expectOne('http://localhost:8000/builder/words');
      expect(req.request.method).toBe('POST');
      expect(req.request.body.all_blocks).toEqual(['a', 'b']);
      req.flush({ availableWords: [] });
    });
  });

  describe('findPhrases', () => {
    it('calls GET /phrases', () => {
      service.findPhrases().subscribe(phrases => {
        expect(phrases).toEqual(['hello world']);
      });
      const req = httpMock.expectOne('http://localhost:8000/phrases');
      req.flush(['hello world']);
    });
  });

  describe('checkBuilderWord', () => {
    it('calls POST /builder/check', () => {
      service.checkBuilderWord('cat', ['c', 'a', 't'], []).subscribe(result => {
        expect(result.canForm).toBe(true);
      });
      const req = httpMock.expectOne('http://localhost:8000/builder/check');
      expect(req.request.body).toEqual({
        word: 'cat',
        all_blocks: ['c', 'a', 't'],
        chosen_words: [],
      });
      req.flush({ canForm: true, blocksUsed: [] });
    });
  });

  describe('getBuilderWords', () => {
    it('calls POST /builder/words with chosen words', () => {
      service.getBuilderWords(['c', 'a', 't'], ['ca'], true).subscribe(state => {
        expect(state.availableWords).toHaveLength(1);
      });
      const req = httpMock.expectOne('http://localhost:8000/builder/words');
      expect(req.request.body).toEqual({
        all_blocks: ['c', 'a', 't'],
        chosen_words: ['ca'],
        common_only: true,
      });
      req.flush({
        remainingBlocks: ['t'],
        phraseWords: ['ca'],
        availableWords: [{ word: 't', blocks: ['t'], numBlocks: 1 }],
      });
    });
  });
});
