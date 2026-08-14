import { catalog } from '../data/catalog';
import type { CalculatorState, Edition, EnchantmentLevels, InputItem, OutputGoal, SearchMode } from '../types';

export const STORAGE_KEY = 'minecraft-enchantment-calculator-v2';
const LEGACY_STORAGE_KEY = 'enchant_pack';

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `input-${Date.now()}-${Math.random().toString(16).slice(2)}`;

export const createInput = (item = 'enchanted_book'): InputItem => ({
  id: createId(),
  item,
  enchantments: {},
  quantity: 1,
  priorWork: 0,
  bypassed: false,
});

export const createDefaultState = (): CalculatorState => ({
  version: 2,
  edition: 'bedrock',
  mode: 'books',
  allowLegacyConflicts: false,
  guideCollapsed: false,
  inputs: [createInput()],
  output: { item: 'boots', enchantments: {} },
});

const numericEnchantments = (value: Record<string, unknown>): EnchantmentLevels =>
  Object.fromEntries(
    Object.entries(value)
      .filter(([key, level]) => /^\d+$/.test(key) && Number.isInteger(Number(level)) && Number(level) > 0)
      .map(([key, level]) => [Number(key), Number(level)]),
  );

const normalizeInput = (value: unknown): InputItem | null => {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const item = typeof input.item === 'string' ? input.item : 'enchanted_book';
  if (!catalog.itemByKey.has(item)) return null;

  return {
    id: typeof input.id === 'string' ? input.id : createId(),
    item,
    enchantments:
      input.enchantments && typeof input.enchantments === 'object'
        ? numericEnchantments(input.enchantments as Record<string, unknown>)
        : numericEnchantments(input),
    quantity:
      item === 'enchanted_book' && Number.isInteger(Number(input.quantity))
        ? Math.min(10, Math.max(1, Number(input.quantity)))
        : 1,
    priorWork: Number(input.priorWork ?? input.prior ?? 0),
    bypassed: Boolean(input.bypassed ?? input.bypass),
  };
};

const normalizeOutput = (value: unknown): OutputGoal => {
  if (!value || typeof value !== 'object') return { item: '', enchantments: {} };
  const output = value as Record<string, unknown>;
  return {
    item: typeof output.item === 'string' && catalog.itemByKey.has(output.item) ? output.item : '',
    enchantments:
      output.enchantments && typeof output.enchantments === 'object'
        ? numericEnchantments(output.enchantments as Record<string, unknown>)
        : numericEnchantments(output),
  };
};

export const normalizeState = (value: unknown): CalculatorState => {
  const defaults = createDefaultState();
  if (!value || typeof value !== 'object') return defaults;
  const saved = value as Record<string, unknown>;
  const inputs = Array.isArray(saved.inputs)
    ? saved.inputs.map(normalizeInput).filter((input): input is InputItem => input !== null)
    : defaults.inputs;

  const edition: Edition = saved.edition === 'java' || saved.edition === 'bedrock' ? saved.edition : 'bedrock';
  const mode: SearchMode =
    saved.mode === 'advanced' || saved.mode === 'books'
      ? saved.mode
      : inputs.length > 0 && saved.version !== 2
        ? 'advanced'
        : 'books';

  return {
    version: 2,
    edition,
    mode,
    allowLegacyConflicts: Boolean(saved.allowLegacyConflicts ?? saved.godarmor),
    guideCollapsed: Boolean(saved.guideCollapsed),
    inputs: inputs.length > 0 ? inputs : [createInput()],
    output: normalizeOutput(saved.output),
  };
};

export const loadState = (): CalculatorState => {
  try {
    const current = localStorage.getItem(STORAGE_KEY);
    if (current) return normalizeState(JSON.parse(current));

    const legacy = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacy) {
      const parsed = JSON.parse(legacy) as Record<string, unknown>;
      return normalizeState({
        ...parsed,
        edition: 'bedrock',
        mode: localStorage.getItem('searchmode') === '2' ? 'advanced' : 'books',
        allowLegacyConflicts: localStorage.getItem('godarmor') === 'true',
        guideCollapsed: localStorage.getItem('hideguide') === 'true',
      });
    }
  } catch {
    // Invalid or unavailable storage should never prevent the calculator from opening.
  }
  return createDefaultState();
};

export const saveState = (state: CalculatorState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable in private browsing; the in-memory app still works.
  }
};

export const removeUnsupportedEnchantments = (state: CalculatorState, edition: Edition) => {
  const supported = new Set(
    catalog.enchantments
      .filter(enchantment => enchantment.editions.includes(edition))
      .map(enchantment => enchantment.id),
  );
  let removed = 0;

  const filterLevels = (levels: EnchantmentLevels) =>
    Object.fromEntries(
      Object.entries(levels).filter(([id]) => {
        const keep = supported.has(Number(id));
        if (!keep) removed += 1;
        return keep;
      }),
    );

  state.inputs = state.inputs.map(input => ({ ...input, enchantments: filterLevels(input.enchantments) }));
  state.output = { ...state.output, enchantments: filterLevels(state.output.enchantments) };
  return removed;
};
