import { Injectable, signal } from '@angular/core';

export const PRESET_CABIN = ['mwja', 'bozt', 'hujiv', 'fsw', 'zmnewq', 'anrxf', 'rexpji', 'jwo', 'yljdr', 'ly', 'cpn'];
export const PRESET_GOOD_ONLY = ['an', 'zmn', 're', 'jw', 'yl', 'ly', 'cp', 'bo', 'hu', 'fs', 'mwj'];

const STORAGE_KEY = 'cabin-blocks-custom';
const PRESET_KEY = 'cabin-blocks-preset';
const USER_PRESETS_KEY = 'cabin-blocks-user-presets';

export type BlockPreset = 'cabin' | 'goodonly' | 'saved' | 'custom' | string;

@Injectable({ providedIn: 'root' })
export class BlockConfigService {
  readonly savedCustomBlocks = signal<string[]>(this._loadSaved());
  readonly userPresets = signal<Record<string, string[]>>(this._loadUserPresets());

  private _initialPreset = this._loadPreset();
  readonly preset = signal<BlockPreset>(this._initialPreset);
  readonly blocks = signal<string[]>(this._blocksForPreset(this._initialPreset));

  usePreset(name: 'cabin' | 'goodonly') {
    this.preset.set(name);
    this.blocks.set(name === 'cabin' ? [...PRESET_CABIN] : [...PRESET_GOOD_ONLY]);
    try { localStorage.setItem(PRESET_KEY, name); } catch { /* ignore */ }
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
      localStorage.setItem(PRESET_KEY, 'saved');
    } catch { /* ignore */ }
  }

  useUserPreset(name: string) {
    const presets = this.userPresets();
    if (!presets[name]) return;
    this.preset.set(name);
    this.blocks.set([...presets[name]]);
    try { localStorage.setItem(PRESET_KEY, name); } catch { /* ignore */ }
  }

  saveUserPreset(name: string, rawInput: string) {
    const parsed = rawInput
      .split(/[\n,]+/)
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 0);
    if (!parsed.length) return;
    const updated = { ...this.userPresets(), [name]: parsed };
    this.userPresets.set(updated);
    try { localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  }

  deleteUserPreset(name: string) {
    const updated = { ...this.userPresets() };
    delete updated[name];
    this.userPresets.set(updated);
    try { localStorage.setItem(USER_PRESETS_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  }

  private _blocksForPreset(p: BlockPreset): string[] {
    if (p === 'cabin') return [...PRESET_CABIN];
    if (p === 'goodonly') return [...PRESET_GOOD_ONLY];
    if (p === 'saved') return [...this.savedCustomBlocks()];
    const userPresets = this._loadUserPresets();
    if (userPresets[p]) return [...userPresets[p]];
    return [];
  }

  private _loadPreset(): BlockPreset {
    try {
      const p = localStorage.getItem(PRESET_KEY);
      if (p === 'cabin' || p === 'goodonly') return p;
      if (p === 'saved' && this._loadSaved().length) return 'saved';
      if (p) {
        const userPresets = this._loadUserPresets();
        if (userPresets[p]) return p;
      }
    } catch { /* ignore */ }
    return this._loadSaved().length ? 'saved' : 'custom';
  }

  private _loadSaved(): string[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as string[]) : [];
    } catch {
      return [];
    }
  }

  private _loadUserPresets(): Record<string, string[]> {
    try {
      const stored = localStorage.getItem(USER_PRESETS_KEY);
      return stored ? (JSON.parse(stored) as Record<string, string[]>) : {};
    } catch {
      return {};
    }
  }
}
