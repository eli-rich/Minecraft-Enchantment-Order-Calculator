import { describe, expect, it } from 'vitest';
import { TreeEvaluator } from '../../src/calculator/tree';
import type { Edition } from '../../src/types';
import type { NodeValue, SearchItem } from '../../src/calculator/types';

const evaluatePair = (edition: Edition, left: SearchItem, right: SearchItem) =>
  new TreeEvaluator([0, 1], edition, false).evaluate([left, right]);

const rootValue = (result: ReturnType<typeof evaluatePair>) => result.root.value as NodeValue;

describe('anvil combination rules', () => {
  it.each([
    ['java', 16],
    ['bedrock', 1],
  ] as const)('handles equal enchantment levels in %s', (edition, expectedCost) => {
    const result = evaluatePair(
      edition,
      { cost: 0, enchant: { item: 'sword', 9: 3, 12: 2, 14: 3 } },
      { cost: 0, enchant: { item: 'sword', 9: 3, 14: 3 } },
    );

    expect(result.enchantmentCost).toBe(expectedCost);
    expect(rootValue(result).enchant).toMatchObject({ item: 'sword', 9: 4, 12: 2, 14: 3 });
  });

  it.each([
    ['java', 15],
    ['bedrock', 8],
  ] as const)('handles unequal enchantment levels in %s', (edition, expectedCost) => {
    const result = evaluatePair(
      edition,
      { cost: 0, enchant: { item: 'sword', 9: 3, 12: 2, 14: 1 } },
      { cost: 0, enchant: { item: 'sword', 9: 1, 14: 3 } },
    );

    expect(result.enchantmentCost).toBe(expectedCost);
    expect(rootValue(result).enchant).toMatchObject({ item: 'sword', 9: 3, 12: 2, 14: 3 });
  });

  it.each([
    ['java', 13],
    ['bedrock', 4],
  ] as const)('charges the edition-specific conflict cost in %s', (edition, expectedCost) => {
    const result = evaluatePair(
      edition,
      { cost: 0, enchant: { item: 'sword', 9: 2, 14: 2 } },
      { cost: 0, enchant: { item: 'sword', 10: 5, 14: 2 } },
    );

    expect(result.enchantmentCost).toBe(expectedCost);
    expect(rootValue(result).enchant).toMatchObject({ item: 'sword', 9: 2, 14: 3 });
    expect(rootValue(result).enchant[10]).toBeUndefined();
  });

  it.each([
    ['java', 7],
    ['bedrock', 3],
  ] as const)('uses book multipliers and ignores inapplicable enchantments in %s', (edition, expectedCost) => {
    const result = evaluatePair(
      edition,
      { cost: 0, enchant: { item: 'sword', 14: 2 } },
      { cost: 0, enchant: { 0: 3, 9: 1, 14: 2 } },
    );

    expect(result.enchantmentCost).toBe(expectedCost);
    expect(rootValue(result).enchant).toMatchObject({ item: 'sword', 9: 1, 14: 3 });
    expect(rootValue(result).enchant[0]).toBeUndefined();
  });

  it.each([
    ['java', 12],
    ['bedrock', 0],
  ] as const)('handles equal maximum-level enchantments in %s', (edition, expectedCost) => {
    const result = evaluatePair(
      edition,
      { cost: 0, enchant: { item: 'sword', 14: 3 } },
      { cost: 0, enchant: { item: 'sword', 14: 3 } },
    );

    expect(result.enchantmentCost).toBe(expectedCost);
    expect(rootValue(result).enchant[14]).toBe(3);
  });

  it.each(['java', 'bedrock'] as const)('charges both prior-work penalties and advances the result in %s', edition => {
    const result = evaluatePair(
      edition,
      { cost: 0, enchant: { item: 'sword', 9: 1, prior: 3 } },
      { cost: 0, enchant: { 17: 1, prior: 1 } },
    );

    expect(result.priorWorkCost).toBe(4);
    expect(rootValue(result).height).toBe(3);
  });
});
