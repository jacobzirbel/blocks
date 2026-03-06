import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'blocks', pathMatch: 'full' },
  {
    path: 'blocks',
    loadComponent: () =>
      import('./components/blocks-grid/blocks-grid').then(m => m.BlocksGrid),
  },
  {
    path: 'check',
    loadComponent: () =>
      import('./components/phrase-checker/phrase-checker').then(m => m.PhraseChecker),
  },
  {
    path: 'words',
    loadComponent: () =>
      import('./components/word-finder/word-finder').then(m => m.WordFinder),
  },
  {
    path: 'builder',
    loadComponent: () =>
      import('./components/phrase-builder/phrase-builder').then(m => m.PhraseBuilder),
  },
];
