import { beforeEach, describe, expect, it } from 'vitest';
import {
  createDefaultState,
  loadState,
  normalizeState,
  removeUnsupportedEnchantments,
  STORAGE_KEY,
} from '../../src/app/state';

describe('calculator state', () => {
  beforeEach(() => localStorage.clear());

  it('defaults first-time visitors to Bedrock', () => {
    expect(createDefaultState().edition).toBe('bedrock');
    expect(loadState().edition).toBe('bedrock');
  });

  it('normalizes a legacy workspace', () => {
    const state = normalizeState({
      inputs: [{ item: 'sword', 9: 3, prior: 1 }, { 17: 3 }, { 26: 1 }],
      output: { item: 'sword', 9: 4 },
    });
    expect(state.version).toBe(2);
    expect(state.mode).toBe('advanced');
    expect(state.inputs[0]).toMatchObject({ item: 'sword', enchantments: { 9: 3 }, priorWork: 1 });
    expect(state.output).toEqual({ item: 'sword', enchantments: { 9: 4 } });
  });

  it('loads the versioned storage key', () => {
    const state = { ...createDefaultState(), edition: 'java' as const };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    expect(loadState().edition).toBe('java');
  });

  it('removes Java-only enchantments when switching to Bedrock', () => {
    const state = createDefaultState();
    state.edition = 'java';
    state.output = { item: 'sword', enchantments: { 9: 5, 1000: 3 } };
    expect(removeUnsupportedEnchantments(state, 'bedrock')).toBe(1);
    expect(state.output.enchantments).toEqual({ 9: 5 });
  });
});
