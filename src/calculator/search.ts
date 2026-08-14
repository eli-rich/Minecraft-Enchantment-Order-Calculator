import priorWorkTreesJson from '../data/prior-work-trees.json';
import searchTreesJson from '../data/search-trees.json';
import { TreeEvaluator } from './tree';
import type {
  FastSearchResult,
  SearchItem,
  SearchOptions,
  SearchResult,
  SearchTreeTable,
  TreeCandidate,
} from './types';

const searchTrees = searchTreesJson as unknown as SearchTreeTable;
const priorWorkTrees = priorWorkTreesJson as unknown as SearchTreeTable;

const contributionCost = (weights: number[], contribution: number[]) => {
  const offset = contribution.length - weights.length;
  return weights.reduce((sum, weight, index) => sum + weight * (contribution[index + offset] ?? 0), 0);
};

const sortedIndexes = (values: number[], reverse = false) =>
  values
    .map((value, index) => ({ value, index }))
    .sort((left, right) => (reverse ? right.value - left.value : left.value - right.value))
    .map(entry => entry.index);

const orderWeights = (originalWeights: number[], contribution: number[]) => {
  const hasItem = originalWeights[0] === 0;
  const weights = originalWeights.slice(hasItem ? 1 : 0);
  const reference = contribution.slice(hasItem ? 1 : 0);
  const ascendingWeights = sortedIndexes(weights);
  const descendingSlots = sortedIndexes(reference, true);
  const result = new Array<number>(weights.length).fill(0);

  weights.forEach((_, index) => {
    const slot = descendingSlots[index];
    const source = ascendingWeights[index];
    if (slot !== undefined && source !== undefined) result[slot] = weights[source] ?? 0;
  });

  if (hasItem) result.unshift(0);
  return result;
};

export const searchFast = (weights: number[]): FastSearchResult => {
  const candidatesByCost = searchTrees[String(weights.length)];
  if (!candidatesByCost || weights.length < 3 || weights.length > 10) {
    throw new Error('Fast search supports between 3 and 10 total inputs.');
  }

  const sortedWeights = weights[0] === 0 ? weights.slice(1).sort((left, right) => right - left) : [...weights].sort();
  let best:
    | { candidate: TreeCandidate; priorWorkCost: number; enchantmentCost: number; total: number }
    | undefined;

  for (const [priorCost, candidates] of Object.entries(candidatesByCost)) {
    for (const candidate of candidates) {
      const enchantmentCost = contributionCost(sortedWeights, candidate.sort);
      const total = Number(priorCost) + enchantmentCost;
      if (!best || total < best.total) {
        best = { candidate, priorWorkCost: Number(priorCost), enchantmentCost, total };
      }
    }
  }

  if (!best) throw new Error('No valid search tree was found.');
  return {
    orderedWeights: orderWeights(weights, best.candidate.flat),
    structure: best.candidate.strc,
    priorWorkCost: best.priorWorkCost,
    enchantmentCost: best.enchantmentCost,
  };
};

const permutations = function* <T>(values: T[], start = 0): Generator<T[]> {
  if (start >= values.length - 1) {
    yield [...values];
    return;
  }

  for (let index = start; index < values.length; index += 1) {
    [values[start], values[index]] = [values[index] as T, values[start] as T];
    yield* permutations(values, start + 1);
    [values[start], values[index]] = [values[index] as T, values[start] as T];
  }
};

const bestOrderingForTree = (items: SearchItem[], candidate: TreeCandidate, options: SearchOptions) => {
  let best:
    | { orderedItems: SearchItem[]; enchantmentCost: number; priorWorkCost: number; total: number }
    | undefined;

  for (const orderedItems of permutations([...items])) {
    if (!orderedItems[0]?.enchant.item) continue;
    const evaluated = new TreeEvaluator(candidate.strc, options.edition, options.allowLegacyConflicts).evaluate(
      orderedItems,
      options.goal,
    );
    const total = evaluated.enchantmentCost + evaluated.priorWorkCost;
    if (!best || total < best.total) {
      best = {
        orderedItems: [...orderedItems],
        enchantmentCost: evaluated.enchantmentCost,
        priorWorkCost: evaluated.priorWorkCost,
        total,
      };
    }
  }

  return best;
};

export const searchAdvanced = (items: SearchItem[], options: SearchOptions): SearchResult => {
  const hasPriorWork = items.some(item => item.enchant.prior !== undefined);
  const table = hasPriorWork ? priorWorkTrees : searchTrees;
  const maximum = hasPriorWork ? 8 : 10;
  const candidatesByCost = table[String(items.length)];

  if (!candidatesByCost || items.length < 3 || items.length > maximum) {
    throw new Error(`Advanced search supports between 3 and ${maximum} inputs for this configuration.`);
  }

  const groups = Object.values(candidatesByCost);
  let best: SearchResult | undefined;
  let bestTotal = Number.POSITIVE_INFINITY;

  groups.forEach((candidates, groupIndex) => {
    options.onProgress?.(groupIndex + 1, groups.length, candidates.length);
    for (const candidate of candidates) {
      const result = bestOrderingForTree(items, candidate, options);
      if (result && result.total < bestTotal) {
        bestTotal = result.total;
        best = {
          orderedItems: result.orderedItems,
          structure: candidate.strc,
          priorWorkCost: result.priorWorkCost,
          enchantmentCost: result.enchantmentCost,
        };
      }
    }
  });

  if (!best || bestTotal >= 100_000) throw new Error('No valid combination satisfies the requested output.');
  return best;
};
