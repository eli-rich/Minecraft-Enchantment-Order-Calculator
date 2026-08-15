import {
  combineAnvilComponents,
  componentFromSearchItem,
  componentSatisfiesGoal,
  enchantmentIds,
  type AnvilComponent,
} from './anvil';
import { SearchHeuristics } from './search-heuristics';
import type { SearchItem, SearchOptions, SearchPlanNode, SearchProgress, SearchResult, TreeStructure } from './types';

const MAXIMUM_EXPLORED_STATES = 500_000;
const FAST_SEARCH_STATES = 5_000;
const FAST_HEURISTIC_WEIGHT = 1.4;
const PROGRESS_INTERVAL = 1_000;

interface IndexedComponent extends AnvilComponent {
  signature: string;
}

interface StateEntry {
  signature: string;
  count: number;
}

interface PreviousStep {
  previousKey: string;
  targetSignature: string;
  sacrificeSignature: string;
  resultSignature: string;
}

interface BestState {
  totalCost: number;
  enchantmentCost: number;
  priorWorkCost: number;
  previous?: PreviousStep;
}

interface QueueEntry {
  key: string;
  entries: StateEntry[];
  totalCost: number;
  estimatedCost: number;
  sequence: number;
}

class MinHeap {
  private readonly values: QueueEntry[] = [];

  get size() {
    return this.values.length;
  }

  push(value: QueueEntry) {
    this.values.push(value);
    let index = this.values.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (!this.precedes(value, this.values[parent]!)) break;
      this.values[index] = this.values[parent]!;
      index = parent;
    }
    this.values[index] = value;
  }

  pop() {
    const first = this.values[0];
    const last = this.values.pop();
    if (!first || !last || this.values.length === 0) return first;

    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.values.length) break;
      const child = right < this.values.length && this.precedes(this.values[right]!, this.values[left]!) ? right : left;
      if (!this.precedes(this.values[child]!, last)) break;
      this.values[index] = this.values[child]!;
      index = child;
    }
    this.values[index] = last;
    return first;
  }

  private precedes(left: QueueEntry, right: QueueEntry) {
    return (
      left.estimatedCost < right.estimatedCost ||
      (left.estimatedCost === right.estimatedCost && left.totalCost > right.totalCost) ||
      (left.estimatedCost === right.estimatedCost &&
        left.totalCost === right.totalCost &&
        left.sequence < right.sequence)
    );
  }
}

const componentSignature = (component: AnvilComponent) =>
  JSON.stringify([
    typeof component.enchant.item === 'string' ? component.enchant.item : '',
    component.workCount,
    enchantmentIds(component.enchant).map(id => [id, Number(component.enchant[id])]),
  ]);

const stateKey = (entries: StateEntry[]) => JSON.stringify(entries.map(entry => [entry.signature, entry.count]));

const countedComponents = (entries: StateEntry[], componentBySignature: Map<string, IndexedComponent>) =>
  entries.map(entry => ({ component: componentBySignature.get(entry.signature)!, count: entry.count }));

const initialEntries = (components: IndexedComponent[]) => {
  const counts = new Map<string, number>();
  for (const component of components) counts.set(component.signature, (counts.get(component.signature) ?? 0) + 1);
  return [...counts]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([signature, count]) => ({ signature, count }));
};

const combineEntries = (
  entries: StateEntry[],
  targetSignature: string,
  sacrificeSignature: string,
  resultSignature: string,
) => {
  const counts = new Map(entries.map(entry => [entry.signature, entry.count]));
  counts.set(targetSignature, (counts.get(targetSignature) ?? 0) - 1);
  counts.set(sacrificeSignature, (counts.get(sacrificeSignature) ?? 0) - 1);
  counts.set(resultSignature, (counts.get(resultSignature) ?? 0) + 1);
  return [...counts]
    .filter(([, count]) => count > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([signature, count]) => ({ signature, count }));
};

const takePlan = (plans: Map<string, SearchPlanNode[]>, signature: string) => {
  const values = plans.get(signature);
  const plan = values?.pop();
  if (!plan) throw new Error('Unable to reconstruct the optimal anvil path.');
  return plan;
};

const reconstructPlan = (
  items: SearchItem[],
  initialComponents: IndexedComponent[],
  goalKey: string,
  bestStates: Map<string, BestState>,
) => {
  const steps: PreviousStep[] = [];
  let currentKey = goalKey;
  while (bestStates.get(currentKey)?.previous) {
    const step = bestStates.get(currentKey)!.previous!;
    steps.push(step);
    currentKey = step.previousKey;
  }
  steps.reverse();

  const plans = new Map<string, SearchPlanNode[]>();
  items.forEach((item, index) => {
    const signature = initialComponents[index]!.signature;
    const values = plans.get(signature) ?? [];
    values.push({ kind: 'leaf', item });
    plans.set(signature, values);
  });

  for (const step of steps) {
    const left = takePlan(plans, step.targetSignature);
    const right = takePlan(plans, step.sacrificeSignature);
    const values = plans.get(step.resultSignature) ?? [];
    values.push({ kind: 'combine', left, right });
    plans.set(step.resultSignature, values);
  }

  const remaining = [...plans.values()].flat();
  if (remaining.length !== 1) throw new Error('The optimal anvil path did not produce one final item.');
  return remaining[0]!;
};

const planStructure = (plan: SearchPlanNode): TreeStructure =>
  plan.kind === 'leaf' ? 0 : [planStructure(plan.left), planStructure(plan.right)];

const planItems = (plan: SearchPlanNode): SearchItem[] =>
  plan.kind === 'leaf' ? [plan.item] : [...planItems(plan.left), ...planItems(plan.right)];

const reportProgress = (options: SearchOptions, exploredStates: number, queuedStates: number) => {
  if (exploredStates % PROGRESS_INTERVAL !== 0) return;
  const progress: SearchProgress = { exploredStates, queuedStates };
  options.onProgress?.(progress);
};

const runSearch = (
  items: SearchItem[],
  options: SearchOptions,
  heuristicWeight: number,
  maximumExploredStates: number,
  exactSearch: boolean,
  minimumPriorWorkOnly: boolean,
  heuristics: SearchHeuristics,
  incumbent?: SearchResult,
): SearchResult | null => {
  if (items.length < 2) throw new Error('Search requires at least two input items.');

  const componentBySignature = new Map<string, IndexedComponent>();
  const initialComponents = items.map(item => {
    const component = componentFromSearchItem(item);
    const indexed = { ...component, signature: componentSignature(component) };
    componentBySignature.set(indexed.signature, indexed);
    return indexed;
  });
  const entries = initialEntries(initialComponents);
  const initialKey = stateKey(entries);
  const bestStates = new Map<string, BestState>([[initialKey, { totalCost: 0, enchantmentCost: 0, priorWorkCost: 0 }]]);
  const finalized = new Set<string>();
  const queue = new MinHeap();
  let sequence = 0;
  let exploredStates = 0;
  let fastResult: SearchResult | null = null;
  queue.push({
    key: initialKey,
    entries,
    totalCost: 0,
    estimatedCost:
      heuristics.remainingCost(countedComponents(entries, componentBySignature), options.goal, options.edition) *
      heuristicWeight,
    sequence: sequence++,
  });

  while (queue.size > 0) {
    const state = queue.pop()!;
    const best = bestStates.get(state.key);
    if (!best || state.totalCost !== best.totalCost || finalized.has(state.key)) continue;
    if (exactSearch && incumbent && state.estimatedCost >= incumbent.enchantmentCost + incumbent.priorWorkCost) {
      return { ...incumbent, exploredStates: exploredStates + (incumbent.exploredStates ?? 0) };
    }
    finalized.add(state.key);
    exploredStates += 1;
    if (exploredStates > maximumExploredStates) {
      if (!exactSearch) return fastResult;
      throw new Error('This search is too complex to finish safely in the browser. Try bypassing optional inputs.');
    }
    if (exactSearch) reportProgress(options, exploredStates, queue.size);

    if (state.entries.length === 1 && state.entries[0]?.count === 1) {
      const component = componentBySignature.get(state.entries[0].signature)!;
      if (!component.enchant.item || !componentSatisfiesGoal(component, options.goal)) continue;
      const plan = reconstructPlan(items, initialComponents, state.key, bestStates);
      const result: SearchResult = {
        orderedItems: planItems(plan),
        structure: planStructure(plan),
        enchantmentCost: best.enchantmentCost,
        priorWorkCost: best.priorWorkCost,
        exploredStates,
      };
      if (exactSearch || heuristicWeight === 1) return result;
      if (
        !fastResult ||
        result.enchantmentCost + result.priorWorkCost < fastResult.enchantmentCost + fastResult.priorWorkCost
      ) {
        fastResult = result;
      }
      continue;
    }

    const currentPriorWorkLowerBound = minimumPriorWorkOnly
      ? heuristics.remainingPriorWorkCost(countedComponents(state.entries, componentBySignature))
      : 0;

    for (let targetIndex = 0; targetIndex < state.entries.length; targetIndex += 1) {
      const targetEntry = state.entries[targetIndex]!;
      const target = componentBySignature.get(targetEntry.signature)!;

      for (let sacrificeIndex = 0; sacrificeIndex < state.entries.length; sacrificeIndex += 1) {
        const sacrificeEntry = state.entries[sacrificeIndex]!;
        if (targetIndex === sacrificeIndex && targetEntry.count < 2) continue;
        const sacrifice = componentBySignature.get(sacrificeEntry.signature)!;
        const combination = combineAnvilComponents(target, sacrifice, options.edition, options.allowLegacyConflicts);
        if (!combination) continue;

        const resultSignature = componentSignature(combination.component);
        if (!componentBySignature.has(resultSignature)) {
          componentBySignature.set(resultSignature, { ...combination.component, signature: resultSignature });
        }
        const nextEntries = combineEntries(
          state.entries,
          targetEntry.signature,
          sacrificeEntry.signature,
          resultSignature,
        );
        const nextKey = stateKey(nextEntries);
        const totalCost = best.totalCost + combination.operationCost;
        const known = bestStates.get(nextKey);
        if (known && known.totalCost <= totalCost) continue;

        const nextComponents = countedComponents(nextEntries, componentBySignature);
        if (
          minimumPriorWorkOnly &&
          combination.priorWorkCost + heuristics.remainingPriorWorkCost(nextComponents) !== currentPriorWorkLowerBound
        ) {
          continue;
        }
        if (!heuristics.canStillReachGoal(nextComponents, options.goal)) continue;
        const lowerBound = heuristics.remainingCost(nextComponents, options.goal, options.edition);
        if (exactSearch && incumbent && totalCost + lowerBound >= incumbent.enchantmentCost + incumbent.priorWorkCost) {
          continue;
        }

        bestStates.set(nextKey, {
          totalCost,
          enchantmentCost: best.enchantmentCost + combination.enchantmentCost,
          priorWorkCost: best.priorWorkCost + combination.priorWorkCost,
          previous: {
            previousKey: state.key,
            targetSignature: targetEntry.signature,
            sacrificeSignature: sacrificeEntry.signature,
            resultSignature,
          },
        });
        queue.push({
          key: nextKey,
          entries: nextEntries,
          totalCost,
          estimatedCost: totalCost + lowerBound * heuristicWeight,
          sequence: sequence++,
        });
      }
    }
  }

  return incumbent ?? fastResult;
};

export const searchAdvanced = (items: SearchItem[], options: SearchOptions): SearchResult => {
  const heuristics = new SearchHeuristics();
  const incumbent = runSearch(items, options, FAST_HEURISTIC_WEIGHT, FAST_SEARCH_STATES, false, true, heuristics);
  const result = runSearch(items, options, 1, MAXIMUM_EXPLORED_STATES, true, false, heuristics, incumbent ?? undefined);
  if (result) return result;
  throw new Error('No survival-valid combination satisfies the requested output.');
};
