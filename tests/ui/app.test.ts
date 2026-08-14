import { beforeEach, describe, expect, it } from 'vitest';
import { CalculatorApp } from '../../src/app/app';

const change = (element: HTMLInputElement | HTMLSelectElement, value?: string) => {
  if (value !== undefined) element.value = value;
  element.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('calculator UI', () => {
  beforeEach(() => {
    localStorage.clear();
    document.body.innerHTML = '<div id="app"></div>';
    new CalculatorApp(document.querySelector('#app')!);
  });

  it('shows a clear Bedrock-first edition control', () => {
    const bedrock = document.querySelector<HTMLInputElement>('input[name="edition"][value="bedrock"]');
    expect(bedrock?.checked).toBe(true);
    expect(document.body.textContent).toContain('Bedrock');
    expect(document.body.textContent).toContain('Java');
  });

  it('switches to advanced mode and adds inputs', () => {
    change(document.querySelector<HTMLInputElement>('input[name="mode"][value="advanced"]')!);
    expect(document.querySelectorAll('.input-card')).toHaveLength(1);
    document.querySelector<HTMLButtonElement>('[data-action="add-input"]')?.click();
    expect(document.querySelectorAll('.input-card')).toHaveLength(2);
  });

  it('calculates a books-mode result', async () => {
    change(document.querySelector<HTMLSelectElement>('[data-action="add-enchantment"]')!, '2');
    change(document.querySelector<HTMLSelectElement>('[data-action="add-enchantment"]')!, '7');
    document.querySelector<HTMLButtonElement>('[data-action="search"]')?.click();
    await Promise.resolve();
    await Promise.resolve();
    expect(document.querySelector('#results')).not.toBeNull();
    expect(document.querySelector('#results')?.textContent).toContain('levels total');
    expect(document.querySelectorAll('.result-steps > li').length).toBeGreaterThan(0);
  });
});
