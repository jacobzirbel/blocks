import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BlockConfigService } from './services/block-config.service';
import { PhraseBuilder } from './components/phrase-builder/phrase-builder';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, PhraseBuilder],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  readonly blockConfig = inject(BlockConfigService);

  editingBlocks = signal(!this.blockConfig.blocks().length);
  customText = signal(this.blockConfig.savedCustomBlocks().join('\n'));

  readonly blockSummary = computed(() => {
    const b = this.blockConfig.blocks();
    return `${b.length} blocks · ${b.reduce((s, bl) => s + bl.length, 0)} letters`;
  });

  applyCustom() {
    this.blockConfig.useCustom(this.customText());
    this.editingBlocks.set(false);
  }

  usePreset(name: 'cabin' | 'goodonly') {
    this.blockConfig.usePreset(name);
    this.editingBlocks.set(false);
  }

  openEditor() {
    this.customText.set(this.blockConfig.savedCustomBlocks().join('\n'));
    this.editingBlocks.set(true);
  }
}
