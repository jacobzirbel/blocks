import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BlockConfigService, BlockPreset } from '../../services/block-config.service';

@Component({
  selector: 'app-blocks-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './blocks-grid.html',
  styleUrl: './blocks-grid.css',
})
export class BlocksGrid {
  readonly blockConfig = inject(BlockConfigService);

  readonly blocks = computed(() => this.blockConfig.blocks().map(l => ({ letters: l })));
  readonly totalLetters = computed(() => this.blockConfig.blocks().reduce((s, b) => s + b.length, 0));
  customText = signal('');

  onPresetChange(preset: BlockPreset) {
    if (preset === 'cabin' || preset === 'goodonly') {
      this.blockConfig.usePreset(preset);
    } else if (preset === 'saved') {
      this.blockConfig.useSaved();
    } else {
      this.blockConfig.preset.set('custom');
      this.customText.set(this.blockConfig.savedCustomBlocks().join('\n'));
    }
  }

  applyCustom() {
    this.blockConfig.useCustom(this.customText());
  }
}
