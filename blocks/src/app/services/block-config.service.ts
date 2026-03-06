import { Injectable, signal } from '@angular/core';

export const PRESET_STANDARD = ['mwja', 'bozt', 'hujiv', 'fsw', 'zmnewq', 'anrxf', 'rexpji', 'jwo', 'yljdr', 'ly', 'cpn'];
export const PRESET_GOOD_ONLY = ['an', 'zmn', 're', 'jw', 'yl', 'ly', 'cp', 'bo', 'hu', 'fs', 'mwj'];

export type BlockPreset = 'standard' | 'goodonly' | 'custom';

@Injectable({ providedIn: 'root' })
export class BlockConfigService {
  readonly preset = signal<BlockPreset>('standard');
  readonly blocks = signal<string[]>([...PRESET_STANDARD]);

  usePreset(name: 'standard' | 'goodonly') {
    this.preset.set(name);
    this.blocks.set(name === 'standard' ? [...PRESET_STANDARD] : [...PRESET_GOOD_ONLY]);
  }

  useCustom(rawInput: string) {
    const parsed = rawInput
      .split(/[\n,]+/)
      .map(s => s.trim().toLowerCase())
      .filter(s => s.length > 0);
    this.preset.set('custom');
    this.blocks.set(parsed);
  }
}
