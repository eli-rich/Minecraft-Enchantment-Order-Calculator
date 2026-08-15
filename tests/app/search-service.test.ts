import { describe, expect, it } from 'vitest';
import { buildAdvancedSearchItems, SearchService } from '../../src/app/search-service';
import { applyBaseItemConstraints, deriveAdvancedOutput } from '../../src/app/constraints';
import { createDefaultState, createInput } from '../../src/app/state';
import { TreeEvaluator } from '../../src/calculator/tree';

describe('advanced search input expansion', () => {
  it('expands identical book quantities into distinct search inputs', () => {
    const state = createDefaultState();
    state.mode = 'advanced';
    const helmet = createInput('helmet');
    const books = createInput();
    books.enchantments = { 6: 1 };
    books.quantity = 4;
    state.inputs = [helmet, books];

    const expanded = buildAdvancedSearchItems(state);
    expect(expanded).toHaveLength(5);
    expect(expanded.slice(1).every(item => item.enchant[6] === 1)).toBe(true);
    expect(new Set(expanded.slice(1)).size).toBe(4);
  });

  it('uses the derived goal to build Respiration III from four Respiration I books', async () => {
    const state = createDefaultState();
    state.mode = 'advanced';
    const helmet = createInput('helmet');
    const books = createInput();
    books.enchantments = { 6: 1 };
    books.quantity = 4;
    state.inputs = [helmet, books];
    applyBaseItemConstraints(state);
    const items = buildAdvancedSearchItems(state);

    const result = await new SearchService().search(state, () => undefined);
    const evaluated = new TreeEvaluator(result.structure, 'bedrock', false).evaluate(result.orderedItems);

    expect(evaluated.root.value).toMatchObject({ enchant: { 6: 3, item: 'helmet' } });
    expect(deriveAdvancedOutput(state).enchantments).toEqual({ 6: 3 });
  });
});
