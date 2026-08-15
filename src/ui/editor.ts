import { enchantmentsForItem, formatItemLabel, ITEM_CATEGORIES, itemsForEdition } from '../data/catalog';
import {
  blockedEnchantmentIds,
  blockedInputEnchantmentIds,
  deriveAdvancedOutput,
  effectiveItemForEnchantments,
  getBaseInput,
} from '../app/constraints';
import { MAXIMUM_BOOK_QUANTITY } from '../app/limits';
import type { CalculatorState, Edition, EnchantmentLevels, InputItem } from '../types';
import { checked, escapeHtml, selected } from './html';

interface EnchantmentEditorOptions {
  levels: EnchantmentLevels;
  itemKey: string;
  edition: Edition;
  scope: 'input' | 'output';
  inputId?: string;
  blockedIds?: ReadonlySet<number>;
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
  const rows = available
    .filter(enchantment => selectedIds.includes(enchantment.id))
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
  const unused = available.filter(
    enchantment => !selectedIds.includes(enchantment.id) && !options.blockedIds?.has(enchantment.id),
  );

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

const groupedItemOptions = (items: ReturnType<typeof itemsForEdition>, current: string) =>
  ITEM_CATEGORIES.map(category => {
    const options = items
      .filter(item => item.category === category.key)
      .map(item => `<option value="${item.key}"${selected(item.key === current)}>${escapeHtml(item.label)}</option>`)
      .join('');
    return options ? `<optgroup label="${category.label}">${options}</optgroup>` : '';
  }).join('');

const itemOptions = (state: CalculatorState, current: string, includeBlank = false) =>
  `${includeBlank ? `<option value=""${selected(current === '')}>Any matching item</option>` : ''}${groupedItemOptions(
    itemsForEdition(state.edition),
    current,
  )}`;

const inputItemOptions = (state: CalculatorState, input: InputItem) => {
  const baseInput = getBaseInput(state);
  if (!baseInput || baseInput.id === input.id) return itemOptions(state, input.item);

  const allowedKeys = new Set([baseInput.item, 'enchanted_book']);
  return groupedItemOptions(
    itemsForEdition(state.edition).filter(item => allowedKeys.has(item.key)),
    input.item,
  );
};

export const renderInputCard = (state: CalculatorState, input: InputItem, index: number) => `
  <article class="input-card${input.bypassed ? ' is-bypassed' : ''}" data-input-id="${escapeHtml(input.id)}">
    <header class="card-header">
      <div>
        <span class="eyebrow">Input ${index + 1}</span>
        <h3>${escapeHtml(itemsForEdition(state.edition).find(item => item.key === input.item)?.label ?? 'Item')}${input.quantity > 1 ? ` × ${input.quantity}` : ''}</h3>
      </div>
      <div class="card-actions">
        <button class="text-button" type="button" data-action="duplicate-input" data-input-id="${escapeHtml(input.id)}">Duplicate</button>
        <button class="text-button" type="button" data-action="toggle-bypass" data-input-id="${escapeHtml(input.id)}" title="Temporarily exclude this input without deleting it">
          ${input.bypassed ? 'Include' : 'Exclude'}
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
        <span>Prior work penalty (PWP)</span>
        <select data-action="set-prior-work" data-input-id="${escapeHtml(input.id)}">
          ${[0, 1, 3, 7, 15, 31, 63, 127]
            .map(cost => `<option value="${cost}"${selected(input.priorWork === cost)}>${cost}</option>`)
            .join('')}
        </select>
        <small class="field-note">PWP = the anvil cost to rename this item − 1.</small>
      </label>
      ${
        input.item === 'enchanted_book'
          ? `<label>
              <span>Identical book copies</span>
              <select data-action="set-input-quantity" data-input-id="${escapeHtml(input.id)}">
                ${Array.from({ length: MAXIMUM_BOOK_QUANTITY }, (_, offset) => offset + 1)
                  .map(
                    quantity =>
                      `<option value="${quantity}"${selected(input.quantity === quantity)}>${quantity}</option>`,
                  )
                  .join('')}
              </select>
            </label>`
          : ''
      }
    </div>
    ${renderEnchantmentEditor({
      levels: input.enchantments,
      itemKey: effectiveItemForEnchantments(state, input),
      edition: state.edition,
      scope: 'input',
      inputId: input.id,
      blockedIds: blockedInputEnchantmentIds(state, input),
    })}
  </article>`;

const renderDerivedOutput = (state: CalculatorState) => {
  const output = deriveAdvancedOutput(state);
  if (!output.item) {
    return '<p class="empty-hint">Add a non-book input to derive the final item and enchantments.</p>';
  }

  const enchantments = enchantmentsForItem(output.item, state.edition).filter(
    enchantment => output.enchantments[enchantment.id] !== undefined,
  );

  return `
    <div class="derived-output-item">
      <span>Item</span>
      <strong>${escapeHtml(formatItemLabel(output.item))}</strong>
    </div>
    <div class="derived-enchantments">
      <span class="derived-label">Enchantments</span>
      ${
        enchantments.length > 0
          ? enchantments
              .map(
                enchantment => `<div class="derived-enchantment-row">
                  <span>${escapeHtml(enchantment.label)}</span>
                  <strong>Level ${output.enchantments[enchantment.id]}</strong>
                </div>`,
              )
              .join('')
          : '<p class="empty-hint">No enchantments on active inputs yet.</p>'
      }
    </div>`;
};

export const renderOutputCard = (state: CalculatorState) => `
  <section class="panel output-panel">
    <div class="section-heading">
      <div>
        <span class="eyebrow">Final item</span>
        <h2>${state.mode === 'books' ? 'What are you making?' : 'Derived output'}</h2>
      </div>
    </div>
    ${
      state.mode === 'advanced'
        ? `<p class="output-help">Calculated automatically from active inputs. Matching lower-level enchantments are combined to the highest reachable level.</p>
           ${renderDerivedOutput(state)}`
        : `<label>
            <span>Item</span>
            <select data-action="set-output-item">
              ${itemOptions(state, state.output.item)}
            </select>
          </label>
          ${renderEnchantmentEditor({
            levels: state.output.enchantments,
            itemKey: state.output.item,
            edition: state.edition,
            scope: 'output',
            blockedIds: blockedEnchantmentIds(
              enchantmentsForItem(state.output.item, state.edition).map(enchantment => enchantment.id),
              Object.keys(state.output.enchantments).map(Number),
              state.allowLegacyConflicts,
            ),
          })}`
    }
  </section>`;

export const renderLegacyOption = (state: CalculatorState) => `
  <label class="toggle-row">
    <input type="checkbox" data-action="toggle-legacy-conflicts"${checked(state.allowLegacyConflicts)}>
    <span>
      <strong>Allow legacy conflicts</strong>
      <small>God Armor protection combinations and Infinity with Mending.</small>
    </span>
  </label>`;
