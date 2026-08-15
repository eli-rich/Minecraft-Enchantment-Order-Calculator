import { describe, expect, it } from 'vitest';
import { componentFromSearchItem } from '../../src/calculator/anvil';
import { SearchHeuristics, type CountedComponent } from '../../src/calculator/search-heuristics';
import type { SearchItem } from '../../src/calculator/types';

const counted = (items: SearchItem[]): CountedComponent[] =>
  items.map(item => ({ component: componentFromSearchItem(item), count: 1 }));

describe('search lower bounds and pruning', () => {
  it.each([{ workCounts: [0, 0, 0] }, { workCounts: [0, 0, 0, 0, 1] }, { workCounts: [0, 1, 2, 2] }])(
    'matches an exhaustive prior-work search for $workCounts',
    ({ workCounts }) => {
      const penalty = (workCount: number) => 2 ** workCount - 1;
      const exhaustive = (counts: number[]): number => {
        if (counts.length < 2) return 0;
        let minimum = Number.POSITIVE_INFINITY;
        for (let left = 0; left < counts.length - 1; left += 1) {
          for (let right = left + 1; right < counts.length; right += 1) {
            const next = counts.filter((_, index) => index !== left && index !== right);
            next.push(Math.max(counts[left]!, counts[right]!) + 1);
            minimum = Math.min(minimum, penalty(counts[left]!) + penalty(counts[right]!) + exhaustive(next));
          }
        }
        return minimum;
      };
      const components = workCounts.map(workCount => ({ component: { enchant: {}, workCount }, count: 1 }));

      expect(new SearchHeuristics().remainingCost(components, undefined, 'bedrock')).toBe(exhaustive(workCounts));
    },
  );

  it('detects when careless merges can no longer reach the derived level', () => {
    const heuristics = new SearchHeuristics();
    const fourLevelOneBooks: CountedComponent[] = [{ component: { enchant: { 0: 1 }, workCount: 0 }, count: 4 }];
    const threeLevelOneBooks: CountedComponent[] = [{ component: { enchant: { 0: 1 }, workCount: 0 }, count: 3 }];

    expect(heuristics.canStillReachGoal(fourLevelOneBooks, { 0: 3 })).toBe(true);
    expect(heuristics.canStillReachGoal(threeLevelOneBooks, { 0: 3 })).toBe(false);
  });

  it.each([
    ['bedrock', 60, 70],
    ['java', 82, 92],
  ] as const)('keeps the reported slow-case bound admissible in %s', (edition, lowerBound, optimalCost) => {
    const copies = (count: number, enchant: SearchItem['enchant']) =>
      Array.from({ length: count }, () => ({ cost: 0, enchant: { ...enchant } }));
    const components = counted([
      { cost: 0, enchant: { item: 'boots' } },
      ...copies(4, { 0: 1 }),
      { cost: 0, enchant: { 0: 3, prior: 1 } },
      ...copies(2, { 5: 2 }),
      { cost: 0, enchant: { 17: 3 } },
      { cost: 0, enchant: { 26: 1 } },
      ...copies(4, { 2: 2 }),
    ]);
    const result = new SearchHeuristics().remainingCost(components, { 0: 4, 2: 4, 5: 3, 17: 3, 26: 1 }, edition);

    expect(result).toBe(lowerBound);
    expect(result).toBeLessThanOrEqual(optimalCost);
  });
});
