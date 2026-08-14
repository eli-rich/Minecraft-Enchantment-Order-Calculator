import type { SearchResult } from '../calculator/types';
import { catalog, enchantmentsForItem } from '../data/catalog';
import type { CalculatorState, Edition, EnchantmentLevels, SearchMode } from '../types';
import { createResultImage, downloadBlob } from './image';
import { readStateFromPng } from './persistence';
import { buildDisplayResult } from './results';
import { SearchService } from './search-service';
import { createDefaultState, createInput, loadState, removeUnsupportedEnchantments, saveState } from './state';
import { validateState } from './validation';
import { renderApp, type ViewState } from '../ui/render';

const levelsForItem = (levels: EnchantmentLevels, itemKey: string, edition: Edition) => {
  const validIds = new Set(enchantmentsForItem(itemKey, edition).map(enchantment => enchantment.id));
  return Object.fromEntries(Object.entries(levels).filter(([id]) => validIds.has(Number(id))));
};

export class CalculatorApp {
  private state = loadState();
  private view: ViewState = { status: '', statusKind: 'idle', result: null, searching: false };
  private readonly searchService = new SearchService();

  constructor(private readonly root: HTMLElement) {
    root.addEventListener('click', event => this.handleClick(event));
    root.addEventListener('change', event => this.handleChange(event));
    document.body.addEventListener('dragover', event => {
      event.preventDefault();
      document.body.classList.add('is-dragging');
    });
    document.body.addEventListener('dragleave', () => document.body.classList.remove('is-dragging'));
    document.body.addEventListener('drop', event => this.handleDrop(event));
    this.render();
  }

  private render() {
    this.root.innerHTML = renderApp(this.state, this.view);
  }

  private commit(message = '') {
    this.searchService.cancel();
    saveState(this.state);
    this.view.result = null;
    this.view.searching = false;
    if (message) {
      this.view.status = message;
      this.view.statusKind = 'idle';
    }
    this.render();
  }

  private inputById(id: string | undefined) {
    return this.state.inputs.find(input => input.id === id);
  }

  private levelsForTarget(target: HTMLElement) {
    if (target.dataset.scope === 'output') return this.state.output.enchantments;
    return this.inputById(target.dataset.inputId)?.enchantments;
  }

  private handleClick(event: Event) {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-action]');
    if (!target) return;
    const action = target.dataset.action;

    if (action === 'toggle-guide') {
      this.state.guideCollapsed = !this.state.guideCollapsed;
      this.commit();
    } else if (action === 'add-input') {
      this.state.inputs.push(createInput());
      this.commit('Input added.');
    } else if (action === 'remove-input') {
      this.state.inputs = this.state.inputs.filter(input => input.id !== target.dataset.inputId);
      this.commit('Input removed.');
    } else if (action === 'duplicate-input') {
      const input = this.inputById(target.dataset.inputId);
      if (!input) return;
      const duplicate = createInput(input.item);
      duplicate.enchantments = { ...input.enchantments };
      duplicate.priorWork = input.priorWork;
      const index = this.state.inputs.indexOf(input);
      this.state.inputs.splice(index + 1, 0, duplicate);
      this.commit('Input duplicated.');
    } else if (action === 'toggle-bypass') {
      const input = this.inputById(target.dataset.inputId);
      if (!input) return;
      input.bypassed = !input.bypassed;
      this.commit(input.bypassed ? 'Input excluded from the next search.' : 'Input included.');
    } else if (action === 'remove-enchantment') {
      const levels = this.levelsForTarget(target);
      if (!levels) return;
      delete levels[Number(target.dataset.enchantmentId)];
      this.commit('Enchantment removed.');
    } else if (action === 'reset') {
      const { edition, mode } = this.state;
      this.state = { ...createDefaultState(), edition, mode };
      this.view = { status: 'Workspace reset.', statusKind: 'idle', result: null, searching: false };
      saveState(this.state);
      this.render();
    } else if (action === 'search') {
      void this.search();
    } else if (action === 'download-result') {
      void this.downloadResult();
    }
  }

  private handleChange(event: Event) {
    const target = event.target as HTMLInputElement | HTMLSelectElement;
    const action = target.dataset.action;
    if (!action) return;

    if (action === 'set-edition') {
      const edition = target.value as Edition;
      const removed = removeUnsupportedEnchantments(this.state, edition);
      this.state.edition = edition;
      this.commit(
        removed > 0
          ? `${removed} unsupported enchantment${removed === 1 ? ' was' : 's were'} removed.`
          : `${edition === 'java' ? 'Java' : 'Bedrock'} rules selected.`,
      );
    } else if (action === 'set-mode') {
      this.state.mode = target.value as SearchMode;
      this.commit(`${this.state.mode === 'books' ? 'Single books' : 'Advanced'} mode selected.`);
    } else if (action === 'toggle-legacy-conflicts') {
      this.state.allowLegacyConflicts = (target as HTMLInputElement).checked;
      this.commit();
    } else if (action === 'set-input-item') {
      const input = this.inputById(target.dataset.inputId);
      if (!input) return;
      const baseInput = this.state.inputs.find(candidate => candidate.item !== 'enchanted_book');
      input.item = target.value;
      input.enchantments = levelsForItem(input.enchantments, input.item, this.state.edition);
      if (baseInput?.id === input.id && input.item !== 'enchanted_book') {
        for (const candidate of this.state.inputs) {
          if (candidate.id === input.id || candidate.item === 'enchanted_book') continue;
          candidate.item = input.item;
          candidate.enchantments = levelsForItem(candidate.enchantments, candidate.item, this.state.edition);
        }
      }
      this.commit();
    } else if (action === 'set-prior-work') {
      const input = this.inputById(target.dataset.inputId);
      if (!input) return;
      input.priorWork = Number(target.value);
      this.commit();
    } else if (action === 'set-output-item') {
      this.state.output.item = target.value;
      this.state.output.enchantments = levelsForItem(
        this.state.output.enchantments,
        this.state.output.item,
        this.state.edition,
      );
      this.commit();
    } else if (action === 'add-enchantment') {
      const levels = this.levelsForTarget(target);
      const definition = catalog.enchantmentById.get(Number(target.value));
      if (!levels || !definition) return;
      levels[definition.id] = definition.maxLevel;
      this.commit(`${definition.label} added at level ${definition.maxLevel}.`);
    } else if (action === 'set-enchantment-level') {
      const levels = this.levelsForTarget(target);
      if (!levels) return;
      levels[Number(target.dataset.enchantmentId)] = Number(target.value);
      this.commit();
    } else if (action === 'import-png') {
      const file = (target as HTMLInputElement).files?.[0];
      if (file) void this.importPng(file);
    }
  }

  private async search() {
    const validation = validateState(this.state);
    if (!validation.valid) {
      this.view.status = validation.message;
      this.view.statusKind = 'error';
      this.render();
      return;
    }

    this.view = { status: 'Preparing search…', statusKind: 'working', result: null, searching: true };
    saveState(this.state);
    this.render();
    const started = performance.now();

    try {
      const result = await this.searchService.search(this.state, message => {
        this.view.status = message;
        this.render();
      });
      this.finishSearch(result, started);
    } catch (error) {
      this.failSearch(error instanceof Error ? error.message : 'The search failed unexpectedly.');
    }
  }

  private finishSearch(result: SearchResult, started: number) {
    this.view.result = buildDisplayResult(result, this.state, Math.round(performance.now() - started));
    this.view.status = 'Optimal order found.';
    this.view.statusKind = 'success';
    this.view.searching = false;
    this.render();
    window.requestAnimationFrame?.(() => document.querySelector('#results')?.scrollIntoView({ behavior: 'smooth' }));
  }

  private failSearch(message: string) {
    this.searchService.cancel();
    this.view.status = message;
    this.view.statusKind = 'error';
    this.view.searching = false;
    this.render();
  }

  private async downloadResult() {
    if (!this.view.result) return;
    try {
      const image = await createResultImage(this.view.result, this.state);
      downloadBlob(image, 'enchantment-order.png');
    } catch (error) {
      this.failSearch(error instanceof Error ? error.message : 'Unable to download the result.');
    }
  }

  private async importPng(file: File) {
    try {
      this.state = await readStateFromPng(file);
      saveState(this.state);
      this.view = { status: 'Workspace restored from PNG.', statusKind: 'success', result: null, searching: false };
      this.render();
    } catch (error) {
      this.failSearch(error instanceof Error ? error.message : 'Unable to import this PNG.');
    }
  }

  private handleDrop(event: DragEvent) {
    event.preventDefault();
    document.body.classList.remove('is-dragging');
    const file = event.dataTransfer?.files[0];
    if (file?.type === 'image/png') void this.importPng(file);
  }
}
