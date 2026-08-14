import { enchantmentsForItem } from '../data/catalog';
import type { CalculatorState, Edition, EnchantmentLevels, InputItem } from '../types';

export const getBaseInput = (state: CalculatorState) => state.inputs.find(input => input.item !== 'enchanted_book');

export const effectiveItemForEnchantments = (state: CalculatorState, input: InputItem) =>
  input.item === 'enchanted_book' ? (getBaseInput(state)?.item ?? input.item) : input.item;

export const levelsForItem = (levels: EnchantmentLevels, itemKey: string, edition: Edition) => {
  const validIds = new Set(enchantmentsForItem(itemKey, edition).map(enchantment => enchantment.id));
  return Object.fromEntries(Object.entries(levels).filter(([id]) => validIds.has(Number(id))));
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

  state.output.item = baseInput.item;
  state.output.enchantments = levelsForItem(state.output.enchantments, baseInput.item, state.edition);
};

export const expandedInputCount = (state: CalculatorState) =>
  state.inputs
    .filter(input => !input.bypassed)
    .reduce((total, input) => total + (input.item === 'enchanted_book' ? input.quantity : 1), 0);
