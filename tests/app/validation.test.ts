import { describe, expect, it } from 'vitest';
import { createDefaultState, createInput } from '../../src/app/state';
import { validateState } from '../../src/app/validation';

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
});
