import { describe, expect, it } from 'vitest';
import { applyBaseItemConstraints, effectiveItemForEnchantments } from '../../src/app/constraints';
import { createDefaultState, createInput } from '../../src/app/state';

describe('base item constraints', () => {
  it('locks output and book enchantments to the physical base item', () => {
    const state = createDefaultState();
    state.mode = 'advanced';
    const helmet = createInput('helmet');
    const book = createInput();
    book.enchantments = { 6: 1, 9: 1 };
    state.inputs = [helmet, book];
    state.output = { item: 'sword', enchantments: { 6: 3, 9: 5 } };

    applyBaseItemConstraints(state);

    expect(state.output).toEqual({ item: 'helmet', enchantments: { 6: 3 } });
    expect(book.enchantments).toEqual({ 6: 1 });
    expect(effectiveItemForEnchantments(state, book)).toBe('helmet');
  });

  it('keeps all physical inputs aligned when the base changes', () => {
    const state = createDefaultState();
    const helmet = createInput('helmet');
    const secondHelmet = createInput('helmet');
    state.inputs = [helmet, secondHelmet];
    helmet.item = 'chestplate';

    applyBaseItemConstraints(state);

    expect(secondHelmet.item).toBe('chestplate');
    expect(state.output.item).toBe('chestplate');
  });
});
