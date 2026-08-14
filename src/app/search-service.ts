import { getEditionMultiplier, getEnchantmentCost } from '../calculator/rules';
import { searchFast } from '../calculator/search';
import type {
  SearchEnchantments,
  SearchItem,
  SearchResult,
  WorkerSearchRequest,
  WorkerSearchResponse,
} from '../calculator/types';
import type { CalculatorState } from '../types';

const toSearchItem = (state: CalculatorState, item: CalculatorState['inputs'][number]): SearchItem => {
  const source = item.item === 'enchanted_book' ? 'book' : 'item';
  const cost = Object.entries(item.enchantments).reduce(
    (sum, [id, level]) =>
      sum + getEnchantmentCost(Number(id), source) * level * getEditionMultiplier(state.edition, Number(id)),
    0,
  );
  const enchant: SearchEnchantments = { ...item.enchantments };
  if (source === 'item') enchant.item = item.item;
  if (item.priorWork > 0) enchant.prior = item.priorWork;
  return { cost, enchant };
};

const searchBooks = (state: CalculatorState): SearchResult => {
  const books = Object.entries(state.output.enchantments).map(([id, level]) => {
    const enchantmentId = Number(id);
    const cost = getEnchantmentCost(enchantmentId, 'book') * level * getEditionMultiplier(state.edition, enchantmentId);
    return { cost, enchant: { [enchantmentId]: level } } satisfies SearchItem;
  });
  const fast = searchFast([0, ...books.map(book => book.cost)]);
  const pool = [...books];
  const orderedItems: SearchItem[] = [{ cost: 0, enchant: { item: state.output.item } }];

  for (const weight of fast.orderedWeights.slice(1)) {
    const index = pool.findIndex(book => book.cost === weight);
    const book = pool.splice(index, 1)[0];
    if (!book) throw new Error('Unable to map the optimized books back to their enchantments.');
    orderedItems.push(book);
  }

  return {
    orderedItems,
    structure: fast.structure,
    priorWorkCost: fast.priorWorkCost,
    enchantmentCost: fast.enchantmentCost,
  };
};

export class SearchService {
  private worker: Worker | null = null;

  cancel() {
    this.worker?.terminate();
    this.worker = null;
  }

  async search(state: CalculatorState, onProgress: (message: string) => void) {
    this.cancel();
    if (state.mode === 'books') return searchBooks(state);

    const items = state.inputs.filter(input => !input.bypassed).map(input => toSearchItem(state, input));
    const goal = Object.keys(state.output.enchantments).length > 0 ? state.output.enchantments : undefined;

    return new Promise<SearchResult>((resolve, reject) => {
      this.worker = new Worker(new URL('../calculator/worker.ts', import.meta.url), { type: 'module' });
      const request: WorkerSearchRequest = {
        type: 'search',
        items,
        options: {
          edition: state.edition,
          allowLegacyConflicts: state.allowLegacyConflicts,
          ...(goal ? { goal } : {}),
        },
      };

      this.worker.addEventListener('message', (event: MessageEvent<WorkerSearchResponse>) => {
        const message = event.data;
        if (message.type === 'progress') {
          onProgress(`Searching group ${message.current} of ${message.total} (${message.candidates} trees)…`);
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
