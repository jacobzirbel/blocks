import { TestBed } from '@angular/core/testing';
import { BlocksGrid } from './blocks-grid';
import { BlockConfigService, PRESET_CABIN, PRESET_GOOD_ONLY } from '../../services/block-config.service';

describe('BlocksGrid', () => {
  let component: BlocksGrid;
  let configService: BlockConfigService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
    const fixture = TestBed.createComponent(BlocksGrid);
    component = fixture.componentInstance;
    configService = TestBed.inject(BlockConfigService);
  });

  afterEach(() => localStorage.clear());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('computes blocks from config', () => {
    const blocks = component.blocks();
    expect(blocks.length).toBe(PRESET_CABIN.length);
    expect(blocks[0]).toEqual({ letters: PRESET_CABIN[0] });
  });

  it('computes total letters', () => {
    const expected = PRESET_CABIN.reduce((s, b) => s + b.length, 0);
    expect(component.totalLetters()).toBe(expected);
  });

  describe('onPresetChange', () => {
    it('switches to goodonly', () => {
      component.onPresetChange('goodonly');
      expect(configService.preset()).toBe('goodonly');
      expect(component.blocks().length).toBe(PRESET_GOOD_ONLY.length);
    });

    it('switches to cabin', () => {
      component.onPresetChange('goodonly');
      component.onPresetChange('cabin');
      expect(configService.preset()).toBe('cabin');
    });

    it('switches to saved', () => {
      configService.useCustom('xx, yy');
      component.onPresetChange('cabin');
      component.onPresetChange('saved');
      expect(configService.preset()).toBe('saved');
      expect(component.blocks()).toEqual([{ letters: 'xx' }, { letters: 'yy' }]);
    });

    it('switches to custom and populates text', () => {
      configService.useCustom('aa, bb');
      component.onPresetChange('custom');
      expect(configService.preset()).toBe('custom');
      expect(component.customText()).toBe('aa\nbb');
    });
  });

  describe('applyCustom', () => {
    it('applies custom text as blocks', () => {
      component.customText.set('foo, bar');
      component.applyCustom();
      expect(configService.blocks()).toEqual(['foo', 'bar']);
    });
  });
});
