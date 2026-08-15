import { searchAdvanced } from '../calculator/search';
import type {
  SearchEnchantments,
  SearchItem,
  SearchOptions,
  SearchResult,
  WorkerSearchRequest,
  WorkerSearchResponse,
} from '../calculator/types';
import type { CalculatorState } from '../types';

const toSearchItem = (item: CalculatorState['inputs'][number]): SearchItem => {
  const source = item.item === 'enchanted_book' ? 'book' : 'item';
  const enchant: SearchEnchantments = { ...item.enchantments };
  if (source === 'item') enchant.item = item.item;
  if (item.priorWork > 0) enchant.prior = item.priorWork;
  return { cost: 0, enchant };
};

const buildBooksSearchItems = (state: CalculatorState): SearchItem[] => [
  { cost: 0, enchant: { item: state.output.item } },
  ...Object.entries(state.output.enchantments).map(([id, level]) => ({
    cost: 0,
    enchant: { [Number(id)]: level },
  })),
];

export const buildAdvancedSearchItems = (state: CalculatorState) =>
  state.inputs
    .filter(input => !input.bypassed)
    .flatMap(input =>
      Array.from({ length: input.item === 'enchanted_book' ? input.quantity : 1 }, () => toSearchItem(input)),
    );

export class SearchService {
  private worker: Worker | null = null;

  cancel() {
    this.worker?.terminate();
    this.worker = null;
  }

  async search(state: CalculatorState, onProgress: (message: string) => void) {
    this.cancel();
    const items = state.mode === 'books' ? buildBooksSearchItems(state) : buildAdvancedSearchItems(state);
    const goal = state.output.enchantments;
    const options: SearchOptions = {
      edition: state.edition,
      allowLegacyConflicts: state.allowLegacyConflicts,
      goal,
    };

    if (typeof Worker === 'undefined') {
      return searchAdvanced(items, {
        ...options,
        onProgress: progress =>
          onProgress(
            `Explored ${progress.exploredStates.toLocaleString()} states (${progress.queuedStates.toLocaleString()} queued)…`,
          ),
      });
    }

    return new Promise<SearchResult>((resolve, reject) => {
      this.worker = new Worker(new URL('../calculator/worker.ts', import.meta.url), { type: 'module' });
      const request: WorkerSearchRequest = {
        type: 'search',
        items,
        options,
      };

      this.worker.addEventListener('message', (event: MessageEvent<WorkerSearchResponse>) => {
        const message = event.data;
        if (message.type === 'progress') {
          onProgress(
            `Explored ${message.exploredStates.toLocaleString()} states (${message.queuedStates.toLocaleString()} queued)…`,
          );
        } else if (message.type === 'result') {
          this.cancel();
          resolve(message.result);
        } else {
          this.cancel();
          reject(new Error(message.message));
        }
      });
      this.worker.addEventListener('error', () => {
        this.cancel();
        reject(new Error('The background search failed unexpectedly.'));
      });
      this.worker.postMessage(request);
    });
  }
}
