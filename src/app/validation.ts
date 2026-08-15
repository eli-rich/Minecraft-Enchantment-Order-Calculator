import { catalog, enchantmentsForItem } from '../data/catalog';
import { isLegacyConflict, PRIOR_WORK_COSTS } from '../calculator/rules';
import type { CalculatorState, EnchantmentLevels } from '../types';
import { effectiveItemForEnchantments, expandedInputCount, getBaseInput } from './constraints';
import { MAXIMUM_BOOK_QUANTITY, MAXIMUM_SEARCH_INPUTS } from './limits';

export { MAXIMUM_SEARCH_INPUTS } from './limits';

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
    if (selectedCount(state.output.enchantments) + 1 > MAXIMUM_SEARCH_INPUTS) {
      return { valid: false, message: `A search can contain at most ${MAXIMUM_SEARCH_INPUTS} inputs.` };
    }
  }

  if (state.output.item) {
    const validOutputIds = new Set(
      enchantmentsForItem(state.output.item, state.edition).map(enchantment => enchantment.id),
    );
    for (const id of Object.keys(state.output.enchantments).map(Number)) {
      if (!validOutputIds.has(id)) return { valid: false, message: 'The output contains an invalid enchantment.' };
      const conflictingId = catalog.enchantmentById
        .get(id)
        ?.conflicts.find(conflict => state.output.enchantments[conflict]);
      if (conflictingId !== undefined && (!state.allowLegacyConflicts || !isLegacyConflict(id, conflictingId))) {
        return { valid: false, message: 'The output contains mutually exclusive enchantments.' };
      }
    }
  }

  if (state.mode === 'books') return { valid: true, message: '' };

  const inputs = state.inputs.filter(input => !input.bypassed);
  const inputCount = expandedInputCount(state);
  if (inputCount < 3) return { valid: false, message: 'Add at least three active input items or books.' };
  if (inputCount > MAXIMUM_SEARCH_INPUTS) {
    return { valid: false, message: `A search can contain at most ${MAXIMUM_SEARCH_INPUTS} inputs.` };
  }

  const physicalItems = inputs.filter(input => input.item !== 'enchanted_book');
  if (physicalItems.length === 0) {
    return { valid: false, message: 'Advanced searches need at least one non-book item.' };
  }
  const itemKey = getBaseInput(state)?.item;
  if (physicalItems.some(input => input.item !== itemKey)) {
    return { valid: false, message: 'All non-book inputs must be the same item type.' };
  }
  if (state.output.item && state.output.item !== itemKey) {
    return { valid: false, message: 'The output item must match the non-book input items.' };
  }

  for (const input of inputs) {
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > MAXIMUM_BOOK_QUANTITY) {
      return { valid: false, message: `Book quantity must be between 1 and ${MAXIMUM_BOOK_QUANTITY}.` };
    }
    if (!PRIOR_WORK_COSTS.includes(input.priorWork as (typeof PRIOR_WORK_COSTS)[number])) {
      return { valid: false, message: 'An input has an invalid prior work penalty.' };
    }
    const effectiveItem = effectiveItemForEnchantments(state, input);
    const validIds = new Set(enchantmentsForItem(effectiveItem, state.edition).map(enchantment => enchantment.id));
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
