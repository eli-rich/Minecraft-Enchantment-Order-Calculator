import { describe, expect, it } from 'vitest';
import { searchAdvanced } from '../../src/calculator/search';
import { TreeEvaluator } from '../../src/calculator/tree';
import type { SearchItem } from '../../src/calculator/types';

const advancedItems: SearchItem[] = [
  { cost: 3, enchant: { item: 'sword', 9: 3 } },
  { cost: 3, enchant: { 9: 3 } },
  { cost: 6, enchant: { 17: 3 } },
];

describe('calculator search regression fixtures', () => {
  it.each([
    ['java', 7],
    ['bedrock', 4],
  ] as const)('preserves the %s advanced-search result', (edition, enchantmentCost) => {
    const result = searchAdvanced(advancedItems, { edition, allowLegacyConflicts: false });
    expect(result.priorWorkCost).toBe(1);
    expect(result.enchantmentCost).toBe(enchantmentCost);
    const evaluated = new TreeEvaluator(result.structure, edition, false).evaluate(result.orderedItems);
    expect(evaluated.invalid).toBe(false);
    expect(evaluated.enchantmentCost).toBe(result.enchantmentCost);
    expect(evaluated.priorWorkCost).toBe(result.priorWorkCost);
  });

  it.each([
    ['java', 7],
    ['bedrock', 4],
  ] as const)('preserves prior-work handling for %s', (edition, enchantmentCost) => {
    const items: SearchItem[] = [
      { cost: 3, enchant: { item: 'sword', 9: 3, prior: 1 } },
      advancedItems[1]!,
      advancedItems[2]!,
    ];
    const result = searchAdvanced(items, { edition, allowLegacyConflicts: false });
    expect(result.priorWorkCost).toBe(4);
    expect(result.enchantmentCost).toBe(enchantmentCost);
  });

  it.each([
    ['java', 5],
    ['bedrock', 4],
  ] as const)(
    'finds a legal path when an input contains a conflicting enchantment in %s',
    (edition, enchantmentCost) => {
      const items: SearchItem[] = [
        { cost: 2, enchant: { item: 'sword', 9: 2 } },
        { cost: 4, enchant: { 10: 2 } },
        { cost: 4, enchant: { 17: 2 } },
      ];
      const result = searchAdvanced(items, { edition, allowLegacyConflicts: false });
      expect(result.enchantmentCost).toBe(enchantmentCost);
    },
  );

  it.each([
    ['java', 12],
    ['bedrock', 8],
  ] as const)('optimally combines four identical Protection I books in %s', (edition, expectedTotal) => {
    const protectionBook: SearchItem = { cost: 1, enchant: { 0: 1 } };
    const result = searchAdvanced(
      [{ cost: 0, enchant: { item: 'boots' } }, protectionBook, protectionBook, protectionBook, protectionBook],
      { edition, allowLegacyConflicts: false },
    );

    expect(result.enchantmentCost + result.priorWorkCost).toBe(expectedTotal);
  });

  it.each(['java', 'bedrock'] as const)(
    'supports more than ten inputs with repeated low-level books in %s',
    edition => {
      const protectionBook: SearchItem = { cost: 0, enchant: { 0: 1 } };
      const items: SearchItem[] = [
        { cost: 0, enchant: { item: 'boots' } },
        ...Array.from({ length: 8 }, () => ({ ...protectionBook, enchant: { ...protectionBook.enchant } })),
        { cost: 0, enchant: { 2: 4 } },
        { cost: 0, enchant: { 7: 3 } },
        { cost: 0, enchant: { 26: 1 } },
      ];
      const goal = { 0: 4, 2: 4, 7: 3, 26: 1 };

      const result = searchAdvanced(items, { edition, allowLegacyConflicts: false, goal });
      const evaluated = new TreeEvaluator(result.structure, edition, false).evaluate(result.orderedItems, goal);

      expect(items).toHaveLength(12);
      expect(evaluated.invalid).toBe(false);
      expect(evaluated.enchantmentCost).toBe(result.enchantmentCost);
      expect(evaluated.priorWorkCost).toBe(result.priorWorkCost);
    },
  );

  it.each([
    ['java', 91],
    ['bedrock', 65],
  ] as const)('combines sixteen identical level-I books into a level-V enchantment in %s', (edition, totalCost) => {
    const items: SearchItem[] = [
      { cost: 0, enchant: { item: 'sword' } },
      ...Array.from({ length: 16 }, () => ({ cost: 0, enchant: { 9: 1 } })),
    ];
    const goal = { 9: 5 };

    const result = searchAdvanced(items, { edition, allowLegacyConflicts: false, goal });
    const evaluated = new TreeEvaluator(result.structure, edition, false).evaluate(result.orderedItems, goal);

    expect(evaluated.invalid).toBe(false);
    expect(result.enchantmentCost + result.priorWorkCost).toBe(totalCost);
  });
});
