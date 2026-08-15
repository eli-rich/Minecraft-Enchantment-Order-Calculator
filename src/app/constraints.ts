import { catalog, enchantmentsForItem } from '../data/catalog';
import type { CalculatorState, Edition, EnchantmentLevels, InputItem, OutputGoal } from '../types';

export const getBaseInput = (state: CalculatorState) => state.inputs.find(input => input.item !== 'enchanted_book');

export const effectiveItemForEnchantments = (state: CalculatorState, input: InputItem) =>
  input.item === 'enchanted_book' ? (getBaseInput(state)?.item ?? input.item) : input.item;

export const levelsForItem = (levels: EnchantmentLevels, itemKey: string, edition: Edition) => {
  const validIds = new Set(enchantmentsForItem(itemKey, edition).map(enchantment => enchantment.id));
  return Object.fromEntries(Object.entries(levels).filter(([id]) => validIds.has(Number(id))));
};

export const deriveAdvancedOutput = (state: CalculatorState): OutputGoal => {
  const baseInput = state.inputs.find(input => !input.bypassed && input.item !== 'enchanted_book');
  if (!baseInput) return { item: '', enchantments: {} };

  const validIds = new Set(enchantmentsForItem(baseInput.item, state.edition).map(enchantment => enchantment.id));
  const countsByEnchantment = new Map<number, Map<number, number>>();

  for (const input of state.inputs.filter(candidate => !candidate.bypassed)) {
    const copies = input.item === 'enchanted_book' ? input.quantity : 1;
    for (const [rawId, rawLevel] of Object.entries(input.enchantments)) {
      const id = Number(rawId);
      if (!validIds.has(id)) continue;
      const maximumLevel = catalog.enchantmentById.get(id)?.maxLevel ?? rawLevel;
      const level = Math.min(rawLevel, maximumLevel);
      const levelCounts = countsByEnchantment.get(id) ?? new Map<number, number>();
      levelCounts.set(level, (levelCounts.get(level) ?? 0) + copies);
      countsByEnchantment.set(id, levelCounts);
    }
  }

  const enchantments: EnchantmentLevels = {};
  for (const [id, levelCounts] of countsByEnchantment) {
    const maximumLevel = catalog.enchantmentById.get(id)?.maxLevel ?? Math.max(...levelCounts.keys());
    for (let level = 1; level < maximumLevel; level += 1) {
      const pairs = Math.floor((levelCounts.get(level) ?? 0) / 2);
      if (pairs > 0) levelCounts.set(level + 1, (levelCounts.get(level + 1) ?? 0) + pairs);
    }
    for (let level = maximumLevel; level >= 1; level -= 1) {
      if ((levelCounts.get(level) ?? 0) > 0) {
        enchantments[id] = level;
        break;
      }
    }
  }

  return { item: baseInput.item, enchantments };
};

export const applyBaseItemConstraints = (state: CalculatorState) => {
  const baseInput = getBaseInput(state);
  if (!baseInput) return;

  for (const input of state.inputs) {
    if (input.item !== 'enchanted_book' && input.item !== baseInput.item) {
      input.item = baseInput.item;
      input.quantity = 1;
    }
    input.enchantments = levelsForItem(input.enchantments, effectiveItemForEnchantments(state, input), state.edition);
  }
};

export const expandedInputCount = (state: CalculatorState) =>
  state.inputs
    .filter(input => !input.bypassed)
    .reduce((total, input) => total + (input.item === 'enchanted_book' ? input.quantity : 1), 0);
