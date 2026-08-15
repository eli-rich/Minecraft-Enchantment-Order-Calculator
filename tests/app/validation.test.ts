import { describe, expect, it } from 'vitest';
import { createDefaultState, createInput } from '../../src/app/state';
import { MAXIMUM_SEARCH_INPUTS, validateState } from '../../src/app/validation';

describe('workspace validation', () => {
  it('accepts a valid books workspace', () => {
    const state = createDefaultState();
    state.output.enchantments = { 2: 4, 7: 3 };
    expect(validateState(state).valid).toBe(true);
  });

  it('rejects mutually exclusive targets unless the legacy option applies', () => {
    const state = createDefaultState();
    state.output.item = 'helmet';
    state.output.enchantments = { 0: 4, 1: 4 };
    expect(validateState(state).valid).toBe(false);
    state.allowLegacyConflicts = true;
    expect(validateState(state).valid).toBe(true);
  });

  it('requires matching physical items in advanced mode', () => {
    const state = createDefaultState();
    state.mode = 'advanced';
    state.inputs = [createInput('sword'), createInput('axe'), createInput('enchanted_book')];
    expect(validateState(state)).toMatchObject({ valid: false, message: expect.stringContaining('same item') });
  });

  it('rejects unsupported prior work values', () => {
    const state = createDefaultState();
    state.mode = 'advanced';
    state.output.item = 'sword';
    state.inputs = [createInput('sword'), createInput(), createInput()];
    state.inputs[0]!.priorWork = 2;
    expect(validateState(state)).toMatchObject({ valid: false, message: expect.stringContaining('prior work') });
  });

  it('accepts advanced searches beyond the old ten-input table limit', () => {
    const state = createDefaultState();
    state.mode = 'advanced';
    state.output = { item: 'boots', enchantments: { 0: 4 } };
    const books = createInput();
    books.enchantments = { 0: 1 };
    books.quantity = 10;
    state.inputs = [createInput('boots'), books, createInput(), createInput()];
    state.inputs[2]!.enchantments = { 2: 4 };
    state.inputs[3]!.enchantments = { 7: 3 };

    expect(validateState(state).valid).toBe(true);
  });

  it('keeps a browser-safety limit independent of generated search tables', () => {
    const state = createDefaultState();
    state.mode = 'advanced';
    state.output.item = 'boots';
    const books = createInput();
    books.enchantments = { 0: 1 };
    books.quantity = 10;
    state.inputs = [createInput('boots'), books, { ...books }, { ...books }];

    expect(validateState(state)).toEqual({
      valid: false,
      message: `A search can contain at most ${MAXIMUM_SEARCH_INPUTS} inputs.`,
    });
  });

  it('flags mutually exclusive enchantments across advanced inputs as an ambiguous output', () => {
    const state = createDefaultState();
    state.mode = 'advanced';
    const boots = createInput('boots');
    boots.enchantments = { 7: 3 };
    const frostWalker = createInput();
    frostWalker.enchantments = { 25: 2 };
    state.inputs = [boots, frostWalker, createInput()];

    expect(validateState(state)).toMatchObject({
      valid: false,
      message: expect.stringContaining('mutually exclusive'),
    });
  });
});
