import { enchantmentsForItem, itemsForEdition } from '../data/catalog';
import type { CalculatorState, Edition, EnchantmentLevels, InputItem } from '../types';
import { checked, escapeHtml, selected } from './html';

interface EnchantmentEditorOptions {
  levels: EnchantmentLevels;
  itemKey: string;
  edition: Edition;
  scope: 'input' | 'output';
  inputId?: string;
}

const editorAttributes = (options: EnchantmentEditorOptions, enchantmentId?: number) =>
  [
    `data-scope="${options.scope}"`,
    options.inputId ? `data-input-id="${escapeHtml(options.inputId)}"` : '',
    enchantmentId === undefined ? '' : `data-enchantment-id="${enchantmentId}"`,
  ]
    .filter(Boolean)
    .join(' ');

export const renderEnchantmentEditor = (options: EnchantmentEditorOptions) => {
  if (!options.itemKey) return '<p class="empty-hint">Choose an item to add target enchantments.</p>';
  const available = enchantmentsForItem(options.itemKey, options.edition);
  const selectedIds = Object.keys(options.levels).map(Number);
  const rows = selectedIds
    .map(id => available.find(enchantment => enchantment.id === id))
    .filter(enchantment => enchantment !== undefined)
    .map(
      enchantment => `
        <div class="enchantment-row">
          <span>${escapeHtml(enchantment.label)}</span>
          <label class="sr-only" for="level-${options.scope}-${options.inputId ?? 'goal'}-${enchantment.id}">
            ${escapeHtml(enchantment.label)} level
          </label>
          <select
            id="level-${options.scope}-${options.inputId ?? 'goal'}-${enchantment.id}"
            data-action="set-enchantment-level"
            ${editorAttributes(options, enchantment.id)}
          >
            ${Array.from({ length: enchantment.maxLevel }, (_, index) => index + 1)
              .map(
                level =>
                  `<option value="${level}"${selected(options.levels[enchantment.id] === level)}>${level}</option>`,
              )
              .join('')}
          </select>
          <button
            class="icon-button"
            type="button"
            data-action="remove-enchantment"
            ${editorAttributes(options, enchantment.id)}
            aria-label="Remove ${escapeHtml(enchantment.label)}"
          >×</button>
        </div>`,
    )
    .join('');
  const unused = available.filter(enchantment => !selectedIds.includes(enchantment.id));

  return `
    <div class="enchantment-editor">
      ${rows || '<p class="empty-hint">No enchantments added yet.</p>'}
      ${
        unused.length > 0
          ? `<label class="add-enchantment">
              <span>Add enchantment</span>
              <select data-action="add-enchantment" ${editorAttributes(options)}>
                <option value="">Choose…</option>
                ${unused
                  .map(enchantment => `<option value="${enchantment.id}">${escapeHtml(enchantment.label)}</option>`)
                  .join('')}
              </select>
            </label>`
          : ''
      }
    </div>`;
};

const itemOptions = (state: CalculatorState, current: string, includeBlank = false) => {
  const items = itemsForEdition(state.edition);
  return `${includeBlank ? `<option value=""${selected(current === '')}>Any matching item</option>` : ''}${items
    .map(item => `<option value="${item.key}"${selected(item.key === current)}>${escapeHtml(item.label)}</option>`)
    .join('')}`;
};

const inputItemOptions = (state: CalculatorState, input: InputItem) => {
  const baseInput = state.inputs.find(candidate => candidate.item !== 'enchanted_book');
  if (!baseInput || baseInput.id === input.id) return itemOptions(state, input.item);

  const allowedKeys = new Set([baseInput.item, 'enchanted_book']);
  return itemsForEdition(state.edition)
    .filter(item => allowedKeys.has(item.key))
    .map(item => `<option value="${item.key}"${selected(item.key === input.item)}>${escapeHtml(item.label)}</option>`)
    .join('');
};

export const renderInputCard = (state: CalculatorState, input: InputItem, index: number) => `
  <article class="input-card${input.bypassed ? ' is-bypassed' : ''}" data-input-id="${escapeHtml(input.id)}">
    <header class="card-header">
      <div>
        <span class="eyebrow">Input ${index + 1}</span>
        <h3>${escapeHtml(itemsForEdition(state.edition).find(item => item.key === input.item)?.label ?? 'Item')}</h3>
      </div>
      <div class="card-actions">
        <button class="text-button" type="button" data-action="duplicate-input" data-input-id="${escapeHtml(input.id)}">Duplicate</button>
        <button class="text-button" type="button" data-action="toggle-bypass" data-input-id="${escapeHtml(input.id)}">
          ${input.bypassed ? 'Include' : 'Bypass'}
        </button>
        <button class="icon-button" type="button" data-action="remove-input" data-input-id="${escapeHtml(input.id)}" aria-label="Remove input ${index + 1}">×</button>
      </div>
    </header>
    <div class="field-grid">
      <label>
        <span>Item</span>
        <select data-action="set-input-item" data-input-id="${escapeHtml(input.id)}">
          ${inputItemOptions(state, input)}
        </select>
      </label>
      <label>
        <span>Prior work penalty</span>
        <select data-action="set-prior-work" data-input-id="${escapeHtml(input.id)}">
          ${[0, 1, 3, 7, 15, 31, 63, 127]
            .map(cost => `<option value="${cost}"${selected(input.priorWork === cost)}>${cost}</option>`)
            .join('')}
        </select>
      </label>
    </div>
    ${renderEnchantmentEditor({
      levels: input.enchantments,
      itemKey: input.item,
      edition: state.edition,
      scope: 'input',
      inputId: input.id,
    })}
  </article>`;

export const renderOutputCard = (state: CalculatorState) => `
  <section class="panel output-panel">
    <div class="section-heading">
      <div>
        <span class="eyebrow">${state.mode === 'books' ? 'Final item' : 'Optional target'}</span>
        <h2>${state.mode === 'books' ? 'What are you making?' : 'Output condition'}</h2>
      </div>
    </div>
    <label>
      <span>Item</span>
      <select data-action="set-output-item">
        ${itemOptions(state, state.output.item, state.mode === 'advanced')}
      </select>
    </label>
    ${renderEnchantmentEditor({
      levels: state.output.enchantments,
      itemKey: state.output.item,
      edition: state.edition,
      scope: 'output',
    })}
  </section>`;

export const renderLegacyOption = (state: CalculatorState) => `
  <label class="toggle-row">
    <input type="checkbox" data-action="toggle-legacy-conflicts"${checked(state.allowLegacyConflicts)}>
    <span>
      <strong>Allow legacy conflicts</strong>
      <small>God Armor protection combinations and Infinity with Mending.</small>
    </span>
  </label>`;
