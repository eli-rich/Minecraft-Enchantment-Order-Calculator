import type { CalculatorState } from '../types';
import type { DisplayResult } from '../app/results';
import { escapeHtml } from './html';
import { renderInputCard, renderLegacyOption, renderOutputCard } from './editor';

export interface ViewState {
  status: string;
  statusKind: 'idle' | 'working' | 'error' | 'success';
  result: DisplayResult | null;
  searching: boolean;
}

const renderResult = (result: DisplayResult | null) => {
  if (!result) return '';
  return `
    <section class="results" id="results" aria-labelledby="results-title">
      <div class="result-summary">
        <div>
          <span class="eyebrow">Optimal order</span>
          <h2 id="results-title">${result.totalCost} levels total</h2>
          <p>${result.search.enchantmentCost} enchantment + ${result.search.priorWorkCost} prior work · ${result.elapsedMs} ms</p>
        </div>
        <button class="secondary-button" type="button" data-action="download-result">Download PNG</button>
      </div>
      <ol class="result-steps">
        ${result.steps
          .map(
            step => `<li>
              <div class="step-number">${step.number}</div>
              <div class="step-content">
                <h3>Combine for ${step.cost} levels</h3>
                <div class="combination">
                  <div><span>Left slot</span><strong>${escapeHtml(step.left)}</strong></div>
                  <span class="plus" aria-hidden="true">+</span>
                  <div><span>Right slot</span><strong>${escapeHtml(step.right)}</strong></div>
                </div>
                <div class="step-output"><span>Result</span><strong>${escapeHtml(step.result)}</strong></div>
              </div>
            </li>`,
          )
          .join('')}
      </ol>
    </section>`;
};

export const renderApp = (state: CalculatorState, view: ViewState) => `
  <header class="site-header">
    <div class="header-inner">
      <a class="brand" href="/" aria-label="Minecraft Enchantment Order Calculator home">
        <span class="brand-mark" aria-hidden="true"></span>
        <span>Minecraft <strong>Enchantment Order</strong></span>
      </a>
      <nav aria-label="Project links">
        <a href="https://minecraft.wiki/w/Anvil_mechanics" target="_blank" rel="noreferrer">Anvil mechanics</a>
        <a href="https://github.com/eli-rich/Minecraft-Enchantment-Order-Calculator" target="_blank" rel="noreferrer">GitHub</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="hero">
      <div>
        <span class="eyebrow">Spend fewer levels</span>
        <h1>Find the cheapest anvil order.</h1>
        <p>Choose your edition, add the items and books you have, and get an exact step-by-step combination order.</p>
      </div>
      <button class="guide-button" type="button" data-action="toggle-guide" aria-expanded="${!state.guideCollapsed}">
        ${state.guideCollapsed ? 'Show guide' : 'Hide guide'}
      </button>
    </section>

    ${
      state.guideCollapsed
        ? ''
        : `<section class="guide panel">
            <h2>Two ways to calculate</h2>
            <div class="guide-grid">
              <div><strong>Books mode</strong><p>Start with a clean item and one book for each enchantment.</p></div>
              <div><strong>Advanced mode</strong><p>Combine existing enchanted items and books, including prior work penalties.</p></div>
              <div><strong>Save and restore</strong><p>Download the result PNG, then drop it back onto this page later.</p></div>
            </div>
          </section>`
    }

    <section class="configuration panel" aria-label="Calculator settings">
      <fieldset class="segmented-field">
        <legend>Edition</legend>
        <div class="segmented-control">
          <label><input type="radio" name="edition" value="bedrock" data-action="set-edition"${state.edition === 'bedrock' ? ' checked' : ''}><span>Bedrock</span></label>
          <label><input type="radio" name="edition" value="java" data-action="set-edition"${state.edition === 'java' ? ' checked' : ''}><span>Java</span></label>
        </div>
      </fieldset>
      <fieldset class="segmented-field mode-field">
        <legend>Search mode</legend>
        <div class="segmented-control">
          <label><input type="radio" name="mode" value="books" data-action="set-mode"${state.mode === 'books' ? ' checked' : ''}><span>Single books</span></label>
          <label><input type="radio" name="mode" value="advanced" data-action="set-mode"${state.mode === 'advanced' ? ' checked' : ''}><span>Advanced</span></label>
        </div>
      </fieldset>
      ${renderLegacyOption(state)}
      <div class="utility-actions">
        <label class="text-button file-button">Import PNG<input type="file" accept="image/png" data-action="import-png"></label>
        <button class="text-button" type="button" data-action="reset">Reset</button>
      </div>
    </section>

    <div class="workspace${state.mode === 'books' ? ' books-workspace' : ''}">
      ${
        state.mode === 'advanced'
          ? `<section class="inputs-section">
              <div class="section-heading">
                <div><span class="eyebrow">What you have</span><h2>Input items</h2></div>
                <button class="secondary-button" type="button" data-action="add-input">Add input</button>
              </div>
              <div class="input-list">${state.inputs.map((input, index) => renderInputCard(state, input, index)).join('')}</div>
            </section>`
          : ''
      }
      ${renderOutputCard(state)}
    </div>

    <section class="search-bar panel">
      <div class="status status-${view.statusKind}" role="status" aria-live="polite">
        ${view.status ? escapeHtml(view.status) : 'Ready to calculate.'}
      </div>
      <button class="primary-button" type="button" data-action="search"${view.searching ? ' disabled' : ''}>
        ${view.searching ? 'Searching…' : 'Find optimal order'}
      </button>
    </section>

    ${renderResult(view.result)}
  </main>

  <footer>
    <p>Runs entirely in your browser. No worlds, accounts, or item data are uploaded.</p>
  </footer>`;
