import { describe, expect, it } from 'vitest';
import { searchAdvanced, searchFast } from '../../src/calculator/search';
import type { SearchItem } from '../../src/calculator/types';

const advancedItems: SearchItem[] = [
  { cost: 3, enchant: { item: 'sword', 9: 3 } },
  { cost: 3, enchant: { 9: 3 } },
  { cost: 6, enchant: { 17: 3 } },
];

describe('calculator search regression fixtures', () => {
  it('preserves the legacy fast-search result', () => {
    expect(searchFast([0, 1, 2, 3])).toEqual({
      orderedWeights: [0, 2, 3, 1],
      structure: [[0, 1], [1, 2]],
      priorWorkCost: 2,
      enchantmentCost: 7,
    });
  });

  it.each([
    ['java', 7],
    ['bedrock', 4],
  ] as const)('preserves the %s advanced-search result', (edition, enchantmentCost) => {
    const result = searchAdvanced(advancedItems, { edition, allowLegacyConflicts: false });
    expect(result.structure).toEqual([[0, 1], [1]]);
    expect(result.priorWorkCost).toBe(1);
    expect(result.enchantmentCost).toBe(enchantmentCost);
    expect(result.orderedItems).toEqual(advancedItems);
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
    ['java', 3],
    ['bedrock', 2],
  ] as const)('preserves conflicting-enchantment costs for %s', (edition, enchantmentCost) => {
    const items: SearchItem[] = [
      { cost: 2, enchant: { item: 'sword', 9: 2 } },
      { cost: 4, enchant: { 10: 2 } },
      { cost: 4, enchant: { 17: 2 } },
    ];
    const result = searchAdvanced(items, { edition, allowLegacyConflicts: false });
    expect(result.enchantmentCost).toBe(enchantmentCost);
  });
});
