import { Injectable, signal } from '@angular/core';

export const PRESET_CABIN = ['mwja', 'bozt', 'hujiv', 'fsw', 'zmnewq', 'anrxf', 'rexpji', 'jwo', 'yljdr', 'ly', 'cpn'];
export const PRESET_GOOD_ONLY = ['an', 'zmn', 're', 'jw', 'yl', 'ly', 'cp', 'bo', 'hu', 'fs', 'mwj'];

const STORAGE_KEY = 'cabin-blocks-custom';

export type BlockPreset = 'cabin' | 'goodonly' | 'saved' | 'custom';

@Injectable({ providedIn: 'root' })
export class BlockConfigService {
  readonly savedCustomBlocks = signal<string[]>(this._loadSaved());
  readonly preset = signal<BlockPreset>(this.savedCustomBlocks().length ? 'saved' : 'custom');
  readonly blocks = signal<string[]>(
    this.savedCustomBlocks().length ? [...this.savedCustomBlocks()] : []
  );

  usePreset(name: 'cabin' | 'goodonly') {
    this.preset.set(name);
    this.blocks.set(name === 'cabin' ? [...PRESET_CABIN] : [...PRESET_GOOD_ONLY]);
  }

  useCustom(rawInput: string) {
    const parsed = rawInput
      .split(/[\n,]+/)
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 0);
    this.savedCustomBlocks.set(parsed);
    this.preset.set('saved');
    this.blocks.set(parsed);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    } catch { /* ignore */ }
  }

  private _loadSaved(): string[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  }
}
