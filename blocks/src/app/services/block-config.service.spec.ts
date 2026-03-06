import { TestBed } from '@angular/core/testing';
import { BlockConfigService, PRESET_CABIN, PRESET_GOOD_ONLY } from './block-config.service';

describe('BlockConfigService', () => {
  let service: BlockConfigService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    service = TestBed.inject(BlockConfigService);
  });

  afterEach(() => localStorage.clear());

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('defaults to cabin preset when no saved blocks', () => {
    expect(service.preset()).toBe('cabin');
    expect(service.blocks()).toEqual(PRESET_CABIN);
  });

  describe('usePreset', () => {
    it('switches to cabin preset', () => {
      service.usePreset('goodonly');
      service.usePreset('cabin');
      expect(service.preset()).toBe('cabin');
      expect(service.blocks()).toEqual(PRESET_CABIN);
    });

    it('switches to goodonly preset', () => {
      service.usePreset('goodonly');
      expect(service.preset()).toBe('goodonly');
      expect(service.blocks()).toEqual(PRESET_GOOD_ONLY);
    });
  });

  describe('useCustom', () => {
    it('parses comma-separated input', () => {
      service.useCustom('ab, cd, ef');
      expect(service.blocks()).toEqual(['ab', 'cd', 'ef']);
      expect(service.preset()).toBe('saved');
    });

    it('parses newline-separated input', () => {
      service.useCustom('ab\ncd\nef');
      expect(service.blocks()).toEqual(['ab', 'cd', 'ef']);
    });

    it('lowercases and trims input', () => {
      service.useCustom('  AB , CD  ');
      expect(service.blocks()).toEqual(['ab', 'cd']);
    });

    it('filters empty entries', () => {
      service.useCustom('ab,,cd,');
      expect(service.blocks()).toEqual(['ab', 'cd']);
    });

    it('saves to localStorage', () => {
      service.useCustom('ab, cd');
      const stored = JSON.parse(localStorage.getItem('cabin-blocks-custom')!);
      expect(stored).toEqual(['ab', 'cd']);
    });
  });

  describe('useSaved', () => {
    it('restores saved custom blocks', () => {
      service.useCustom('xx, yy');
      service.usePreset('cabin');
      service.useSaved();
      expect(service.blocks()).toEqual(['xx', 'yy']);
      expect(service.preset()).toBe('saved');
    });
  });

  describe('persistence', () => {
    it('loads saved blocks on init', () => {
      localStorage.setItem('cabin-blocks-custom', JSON.stringify(['saved1', 'saved2']));
      const fresh = new BlockConfigService();
      expect(fresh.savedCustomBlocks()).toEqual(['saved1', 'saved2']);
      expect(fresh.preset()).toBe('saved');
      expect(fresh.blocks()).toEqual(['saved1', 'saved2']);
    });

    it('handles corrupt localStorage gracefully', () => {
      localStorage.setItem('cabin-blocks-custom', 'not-json');
      const fresh = new BlockConfigService();
      expect(fresh.savedCustomBlocks()).toEqual([]);
      expect(fresh.preset()).toBe('cabin');
    });
  });
});
