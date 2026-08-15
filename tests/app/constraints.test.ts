import { describe, expect, it } from 'vitest';
import {
  applyBaseItemConstraints,
  blockedInputEnchantmentIds,
  deriveAdvancedOutput,
  effectiveItemForEnchantments,
} from '../../src/app/constraints';
import { createDefaultState, createInput } from '../../src/app/state';

describe('base item constraints', () => {
  it('derives the output and limits book enchantments to the physical base item', () => {
    const state = createDefaultState();
    state.mode = 'advanced';
    const helmet = createInput('helmet');
    const book = createInput();
    book.enchantments = { 6: 1, 9: 1 };
    state.inputs = [helmet, book];
    state.output = { item: 'sword', enchantments: { 6: 3, 9: 5 } };

    applyBaseItemConstraints(state);

    expect(deriveAdvancedOutput(state)).toEqual({ item: 'helmet', enchantments: { 6: 1 } });
    expect(book.enchantments).toEqual({ 6: 1 });
    expect(effectiveItemForEnchantments(state, book)).toBe('helmet');
  });

  it('keeps all physical inputs aligned when the base changes', () => {
    const state = createDefaultState();
    state.mode = 'advanced';
    const helmet = createInput('helmet');
    const secondHelmet = createInput('helmet');
    state.inputs = [helmet, secondHelmet];
    helmet.item = 'chestplate';

    applyBaseItemConstraints(state);

    expect(secondHelmet.item).toBe('chestplate');
    expect(deriveAdvancedOutput(state).item).toBe('chestplate');
  });

  it('derives the highest reachable level from identical and mixed-level books', () => {
    const state = createDefaultState();
    state.mode = 'advanced';
    const levelOneBooks = createInput();
    levelOneBooks.enchantments = { 6: 1 };
    levelOneBooks.quantity = 2;
    const levelTwoBook = createInput();
    levelTwoBook.enchantments = { 6: 2 };
    state.inputs = [createInput('helmet'), levelOneBooks, levelTwoBook];

    applyBaseItemConstraints(state);

    expect(deriveAdvancedOutput(state)).toEqual({ item: 'helmet', enchantments: { 6: 3 } });
  });

  it('excludes bypassed inputs from the derived output', () => {
    const state = createDefaultState();
    state.mode = 'advanced';
    const helmet = createInput('helmet');
    helmet.enchantments = { 6: 2 };
    const bypassedBook = createInput();
    bypassedBook.enchantments = { 5: 3 };
    bypassedBook.bypassed = true;
    state.inputs = [helmet, bypassedBook];

    applyBaseItemConstraints(state);

    expect(deriveAdvancedOutput(state)).toEqual({ item: 'helmet', enchantments: { 6: 2 } });
  });

  it('derives an empty advanced output without overwriting the books-mode selection', () => {
    const state = createDefaultState();
    state.mode = 'advanced';
    state.output = { item: 'helmet', enchantments: { 6: 3 } };

    applyBaseItemConstraints(state);

    expect(deriveAdvancedOutput(state)).toEqual({ item: '', enchantments: {} });
    expect(state.output).toEqual({ item: 'helmet', enchantments: { 6: 3 } });
  });

  it('does not derive an item from a bypassed physical input', () => {
    const state = createDefaultState();
    state.mode = 'advanced';
    const helmet = createInput('helmet');
    helmet.bypassed = true;
    const book = createInput();
    book.enchantments = { 6: 3 };
    state.inputs = [helmet, book];

    expect(deriveAdvancedOutput(state)).toEqual({ item: '', enchantments: {} });
  });

  it('blocks conflicts selected on other active inputs unless the legacy pair is enabled', () => {
    const state = createDefaultState();
    state.mode = 'advanced';
    const helmet = createInput('helmet');
    helmet.enchantments = { 0: 4 };
    const book = createInput();
    state.inputs = [helmet, book];

    expect(blockedInputEnchantmentIds(state, book)).toContain(1);
    state.allowLegacyConflicts = true;
    expect(blockedInputEnchantmentIds(state, book)).not.toContain(1);
    helmet.bypassed = true;
    state.allowLegacyConflicts = false;
    expect(blockedInputEnchantmentIds(state, book)).not.toContain(1);
  });
});
