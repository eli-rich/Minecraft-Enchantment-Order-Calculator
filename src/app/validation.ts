import { catalog, enchantmentsForItem } from '../data/catalog';
import type { CalculatorState, EnchantmentLevels } from '../types';

export interface ValidationResult {
  valid: boolean;
  message: string;
}

const selectedCount = (levels: EnchantmentLevels) => Object.values(levels).filter(level => level > 0).length;

export const validateState = (state: CalculatorState): ValidationResult => {
  if (!state.output.item && state.mode === 'books') {
    return { valid: false, message: 'Choose the item you want to enchant.' };
  }

  if (state.mode === 'books') {
    if (selectedCount(state.output.enchantments) < 2) {
      return { valid: false, message: 'Add at least two enchanted books.' };
    }
    return { valid: true, message: '' };
  }

  const inputs = state.inputs.filter(input => !input.bypassed);
  if (inputs.length < 3) return { valid: false, message: 'Add at least three active input items or books.' };
  if (inputs.length > (inputs.some(input => input.priorWork > 0) ? 8 : 10)) {
    return { valid: false, message: 'This search has too many inputs for the available search tables.' };
  }

  const physicalItems = inputs.filter(input => input.item !== 'enchanted_book');
  if (physicalItems.length === 0) {
    return { valid: false, message: 'Advanced searches need at least one non-book item.' };
  }
  const itemKey = physicalItems[0]?.item;
  if (physicalItems.some(input => input.item !== itemKey)) {
    return { valid: false, message: 'All non-book inputs must be the same item type.' };
  }
  if (state.output.item && state.output.item !== itemKey) {
    return { valid: false, message: 'The output item must match the non-book input items.' };
  }

  for (const input of inputs) {
    const validIds = new Set(enchantmentsForItem(input.item, state.edition).map(enchantment => enchantment.id));
    for (const id of Object.keys(input.enchantments).map(Number)) {
      if (!validIds.has(id)) return { valid: false, message: `An enchantment is not valid for ${input.item}.` };
      const definition = catalog.enchantmentById.get(id);
      if (definition?.conflicts.some(conflict => input.enchantments[conflict])) {
        return { valid: false, message: 'An input contains mutually exclusive enchantments.' };
      }
    }
  }

  return { valid: true, message: '' };
};
