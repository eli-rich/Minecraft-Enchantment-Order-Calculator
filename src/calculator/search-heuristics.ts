import type { Edition, EnchantmentLevels } from '../types';
import type { AnvilComponent } from './anvil';
import { priorWorkPenalty } from './anvil';
import { getEditionMultiplier, getEnchantmentCost, getLevelCost, getMaximumLevel } from './rules';

export interface CountedComponent {
  component: AnvilComponent;
  count: number;
}

interface EnchantmentPart {
  item: boolean;
  level: number;
}

const partKey = (parts: EnchantmentPart[]) =>
  parts
    .map(part => `${part.item ? 'i' : 'b'}${part.level}`)
    .sort()
    .join(',');

const withoutPair = (parts: EnchantmentPart[], leftIndex: number, rightIndex: number, result: EnchantmentPart) =>
  parts.filter((_, index) => index !== leftIndex && index !== rightIndex).concat(result);

export class SearchHeuristics {
  private readonly priorWorkCache = new Map<string, number>();
  private readonly enchantmentCache = new Map<string, number>();

  canStillReachGoal(components: CountedComponent[], goal: EnchantmentLevels | undefined) {
    if (!goal) return true;

    return Object.entries(goal).every(([rawId, goalLevel]) => {
      const id = Number(rawId);
      const levelCounts = new Map<number, number>();
      for (const { component, count } of components) {
        const level = Number(component.enchant[id] ?? 0);
        if (level > 0) levelCounts.set(level, (levelCounts.get(level) ?? 0) + count);
      }

      if ([...levelCounts.keys()].some(level => level >= goalLevel)) return true;
      for (let level = 1; level < goalLevel; level += 1) {
        const pairs = Math.floor((levelCounts.get(level) ?? 0) / 2);
        if (pairs > 0) levelCounts.set(level + 1, (levelCounts.get(level + 1) ?? 0) + pairs);
      }
      return (levelCounts.get(goalLevel) ?? 0) > 0;
    });
  }

  remainingCost(components: CountedComponent[], goal: EnchantmentLevels | undefined, edition: Edition) {
    return this.remainingPriorWorkCost(components) + this.remainingEnchantmentCost(components, goal, edition);
  }

  remainingPriorWorkCost(components: CountedComponent[]) {
    const workCounts = components
      .flatMap(({ component, count }) => Array.from({ length: count }, () => component.workCount))
      .sort((left, right) => left - right);
    const key = workCounts.join(',');
    const cached = this.priorWorkCache.get(key);
    if (cached !== undefined) return cached;

    let cost = 0;
    while (workCounts.length > 1) {
      const left = workCounts.shift()!;
      const right = workCounts.shift()!;
      cost += priorWorkPenalty(left) + priorWorkPenalty(right);
      const result = Math.max(left, right) + 1;
      const insertionIndex = workCounts.findIndex(workCount => workCount > result);
      workCounts.splice(insertionIndex < 0 ? workCounts.length : insertionIndex, 0, result);
    }

    this.priorWorkCache.set(key, cost);
    return cost;
  }

  private remainingEnchantmentCost(
    components: CountedComponent[],
    goal: EnchantmentLevels | undefined,
    edition: Edition,
  ) {
    if (!goal) return 0;
    return Object.entries(goal).reduce((total, [rawId, goalLevel]) => {
      const id = Number(rawId);
      const parts = components.flatMap(({ component, count }) => {
        const level = Number(component.enchant[id] ?? 0);
        const item = Boolean(component.enchant.item);
        return item || level > 0 ? Array.from({ length: count }, () => ({ item, level })) : [];
      });
      return total + this.minimumEnchantmentCost(parts, id, goalLevel, edition);
    }, 0);
  }

  private minimumEnchantmentCost(parts: EnchantmentPart[], id: number, goalLevel: number, edition: Edition): number {
    const key = `${edition}:${id}:${goalLevel}:${partKey(parts)}`;
    const cached = this.enchantmentCache.get(key);
    if (cached !== undefined) return cached;

    if (parts.length === 1) {
      const cost = parts[0]!.item && parts[0]!.level >= goalLevel ? 0 : Number.POSITIVE_INFINITY;
      this.enchantmentCache.set(key, cost);
      return cost;
    }

    let minimum = Number.POSITIVE_INFINITY;
    const seenPairs = new Set<string>();
    for (let leftIndex = 0; leftIndex < parts.length; leftIndex += 1) {
      const left = parts[leftIndex]!;
      for (let rightIndex = 0; rightIndex < parts.length; rightIndex += 1) {
        if (leftIndex === rightIndex) continue;
        const right = parts[rightIndex]!;
        if (!left.item && right.item) continue;
        const pair = `${left.item ? 'i' : 'b'}${left.level}>${right.item ? 'i' : 'b'}${right.level}`;
        if (seenPairs.has(pair)) continue;
        seenPairs.add(pair);

        const finalLevel =
          right.level === 0
            ? left.level
            : left.level === right.level
              ? Math.min(getMaximumLevel(id), left.level + 1)
              : Math.max(left.level, right.level);
        const operationCost =
          right.level === 0
            ? 0
            : getLevelCost(edition, left.level, finalLevel) *
              getEnchantmentCost(id, right.item ? 'item' : 'book') *
              getEditionMultiplier(edition, id);
        const next = withoutPair(parts, leftIndex, rightIndex, { item: left.item, level: finalLevel });
        minimum = Math.min(minimum, operationCost + this.minimumEnchantmentCost(next, id, goalLevel, edition));
      }
    }

    this.enchantmentCache.set(key, minimum);
    return minimum;
  }
}
