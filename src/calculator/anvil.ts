import type { Edition, EnchantmentLevels } from '../types';
import {
  getConflicts,
  getEditionMultiplier,
  getEnchantmentCost,
  getLevelCost,
  getMaximumLevel,
  isLegacyConflict,
  isValidForItem,
  PRIOR_WORK_COSTS,
  sourceType,
} from './rules';
import type { SearchEnchantments, SearchItem } from './types';

export const MAXIMUM_SURVIVAL_COST = 39;

export interface AnvilComponent {
  enchant: SearchEnchantments;
  workCount: number;
}

export interface AnvilCombination {
  component: AnvilComponent;
  enchantmentCost: number;
  priorWorkCost: number;
  operationCost: number;
}

export const enchantmentIds = (enchantments: SearchEnchantments) =>
  Object.keys(enchantments)
    .filter(key => key !== 'item' && key !== 'prior')
    .map(Number)
    .sort((left, right) => left - right);

export const priorWorkPenalty = (workCount: number) => Math.min(Number.MAX_SAFE_INTEGER, 2 ** workCount - 1);

export const workCountFromPenalty = (penalty: number | undefined) => {
  if (!penalty) return 0;
  const index = PRIOR_WORK_COSTS.findIndex(cost => cost === penalty);
  if (index < 0) throw new Error(`Unsupported prior-work penalty: ${penalty}.`);
  return index;
};

export const componentFromSearchItem = (item: SearchItem): AnvilComponent => {
  const enchant = { ...item.enchant };
  const workCount = workCountFromPenalty(typeof enchant.prior === 'number' ? enchant.prior : undefined);
  delete enchant.prior;
  return { enchant, workCount };
};

export const componentSatisfiesGoal = (component: AnvilComponent, goal: EnchantmentLevels | undefined) => {
  if (!goal) return true;
  return Object.entries(goal).every(([id, level]) => Number(component.enchant[Number(id)] ?? 0) >= level);
};

export const combineAnvilComponents = (
  left: AnvilComponent,
  right: AnvilComponent,
  edition: Edition,
  allowLegacyConflicts: boolean,
): AnvilCombination | null => {
  const leftItem = typeof left.enchant.item === 'string' ? left.enchant.item : undefined;
  const rightItem = typeof right.enchant.item === 'string' ? right.enchant.item : undefined;

  if ((!leftItem && rightItem) || (leftItem && rightItem && leftItem !== rightItem)) return null;

  const result: SearchEnchantments = {};
  for (const id of enchantmentIds(left.enchant)) result[id] = left.enchant[id];

  let enchantmentCost = 0;
  let acceptedEnchantment = false;

  for (const id of enchantmentIds(right.enchant)) {
    if (leftItem && !isValidForItem(leftItem, id)) continue;

    const conflictingId = getConflicts(id).find(conflictId => result[conflictId] !== undefined);
    const acceptsLegacyConflict =
      allowLegacyConflicts && conflictingId !== undefined && isLegacyConflict(id, conflictingId);

    if (conflictingId !== undefined && !acceptsLegacyConflict) {
      if (edition === 'java') enchantmentCost += 1;
      continue;
    }

    acceptedEnchantment = true;
    const rightLevel = Number(right.enchant[id]);
    const leftLevel = Number(result[id] ?? 0);
    const finalLevel =
      leftLevel === rightLevel ? Math.min(getMaximumLevel(id), leftLevel + 1) : Math.max(leftLevel, rightLevel);
    const multiplier = getEnchantmentCost(id, sourceType(right.enchant));
    enchantmentCost += getLevelCost(edition, leftLevel, finalLevel) * multiplier * getEditionMultiplier(edition, id);
    result[id] = finalLevel;
  }

  // With durability and renaming intentionally outside the calculator's model,
  // a sacrifice that contributes no enchantment cannot produce an anvil result.
  if (!acceptedEnchantment) return null;
  if (leftItem) result.item = leftItem;

  const priorWorkCost = priorWorkPenalty(left.workCount) + priorWorkPenalty(right.workCount);
  const operationCost = enchantmentCost + priorWorkCost;
  if (operationCost > MAXIMUM_SURVIVAL_COST) return null;

  return {
    component: {
      enchant: result,
      workCount: Math.max(left.workCount, right.workCount) + 1,
    },
    enchantmentCost,
    priorWorkCost,
    operationCost,
  };
};
