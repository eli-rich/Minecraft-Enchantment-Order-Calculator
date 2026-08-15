import { catalog, formatItemLabel } from '../data/catalog';
import { TreeEvaluator } from '../calculator/tree';
import type { NodeValue, ResultNode, SearchResult } from '../calculator/types';
import type { CalculatorState } from '../types';
import { deriveAdvancedOutput } from './constraints';

export interface ResultStep {
  number: number;
  left: string;
  right: string;
  result: string;
  cost: number;
}

export interface DisplayResult {
  search: SearchResult;
  steps: ResultStep[];
  totalCost: number;
  elapsedMs: number;
}

const romanNumeral = (level: number) => {
  const values: Array<[number, string]> = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let remaining = level;
  let result = '';
  for (const [value, numeral] of values) {
    while (remaining >= value) {
      result += numeral;
      remaining -= value;
    }
  }
  return result;
};

const isNodeValue = (value: ResultNode['value']): value is NodeValue => typeof value !== 'number';

export const describeNode = (node: ResultNode) => {
  if (!isNodeValue(node.value)) return 'Unknown item';
  const name = node.value.enchant.item ? formatItemLabel(node.value.enchant.item) : 'Enchanted Book';
  const enchantments = Object.entries(node.value.enchant)
    .filter(([key]) => /^\d+$/.test(key))
    .map(([id, level]) => {
      const definition = catalog.enchantmentById.get(Number(id));
      return `${definition?.label ?? id} ${romanNumeral(Number(level))}`;
    });
  return enchantments.length > 0 ? `${name} — ${enchantments.join(', ')}` : name;
};

export const buildDisplayResult = (search: SearchResult, state: CalculatorState, elapsedMs: number): DisplayResult => {
  const goal = state.mode === 'advanced' ? deriveAdvancedOutput(state).enchantments : state.output.enchantments;
  const evaluated = new TreeEvaluator(search.structure, state.edition, state.allowLegacyConflicts).evaluate(
    search.orderedItems,
    goal,
  );
  const steps: ResultStep[] = [];

  const visit = (node: ResultNode): string => {
    if (!node.left || !node.right || !isNodeValue(node.value)) return describeNode(node);
    const left = visit(node.left);
    const right = visit(node.right);
    const result = describeNode(node);
    steps.push({ number: steps.length + 1, left, right, result, cost: node.value.cost + (node.value.prior ?? 0) });
    return result;
  };

  visit(evaluated.root);
  return {
    search,
    steps,
    totalCost: search.enchantmentCost + search.priorWorkCost,
    elapsedMs,
  };
};
