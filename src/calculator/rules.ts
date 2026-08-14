import { catalog } from '../data/catalog';
import type { Edition } from '../types';
import type { SearchEnchantments } from './types';

export const PRIOR_WORK_COSTS = [0, 1, 3, 7, 15, 31, 63, 127, 255] as const;

const protectionIds = new Set([0, 1, 3, 4]);
const infinityAndMendingIds = new Set([22, 26]);

export const isLegacyConflict = (leftId: number, rightId: number) =>
  (protectionIds.has(leftId) && protectionIds.has(rightId)) ||
  (infinityAndMendingIds.has(leftId) && infinityAndMendingIds.has(rightId));

export const getLevelCost = (edition: Edition, initialLevel: number, finalLevel: number) =>
  edition === 'java' ? finalLevel : Math.abs(finalLevel - initialLevel);

export const getEditionMultiplier = (edition: Edition, enchantmentId: number) =>
  edition === 'bedrock' && enchantmentId === 29 ? 0.5 : 1;

export const getEnchantmentCost = (enchantmentId: number, source: 'item' | 'book') =>
  catalog.enchantmentById.get(enchantmentId)?.costs[source] ?? 0;

export const getMaximumLevel = (enchantmentId: number) => catalog.enchantmentById.get(enchantmentId)?.maxLevel ?? 0;

export const getConflicts = (enchantmentId: number) => catalog.enchantmentById.get(enchantmentId)?.conflicts ?? [];

export const isValidForItem = (itemKey: string, enchantmentId: number) =>
  catalog.itemByKey.get(itemKey)?.enchantments.includes(enchantmentId) ?? false;

export const sourceType = (enchantments: SearchEnchantments): 'item' | 'book' => (enchantments.item ? 'item' : 'book');
