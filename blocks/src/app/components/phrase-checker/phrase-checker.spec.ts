import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PhraseChecker } from './phrase-checker';

describe('PhraseChecker', () => {
  let component: PhraseChecker;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(PhraseChecker);
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

  it('starts with empty state', () => {
    expect(component.phrase).toBe('');
    expect(component.loading()).toBe(false);
    expect(component.result()).toBeNull();
  });

  describe('check', () => {
    it('does nothing for empty phrase', () => {
      component.phrase = '  ';
      component.check();
      httpMock.expectNone('http://localhost:8000/check');
      expect(component.loading()).toBe(false);
    });

    it('sets loading and calls API', () => {
      component.phrase = 'hello';
      component.check();
      expect(component.loading()).toBe(true);

      const req = httpMock.expectOne('http://localhost:8000/check');
      req.flush({
        phrase: 'hello',
        canForm: true,
        blocksUsed: ['h', 'e'],
        missingLetters: {},
      });

      expect(component.loading()).toBe(false);
      expect(component.result()!.canForm).toBe(true);
    });

    it('handles error', () => {
      component.phrase = 'hello';
      component.check();

      const req = httpMock.expectOne('http://localhost:8000/check');
      req.error(new ProgressEvent('error'));

      expect(component.loading()).toBe(false);
      expect(component.result()).toBeNull();
    });
  });

  describe('missingEntries', () => {
    it('returns empty array when no result', () => {
      expect(component.missingEntries()).toEqual([]);
    });

    it('returns formatted missing letters', () => {
      component.phrase = 'qqq';
      component.check();
      httpMock.expectOne('http://localhost:8000/check').flush({
        phrase: 'qqq',
        canForm: false,
        blocksUsed: [],
        missingLetters: { q: 3 },
      });

      const entries = component.missingEntries();
      expect(entries).toEqual([{ letter: 'q', count: 3 }]);
    });
  });
});
