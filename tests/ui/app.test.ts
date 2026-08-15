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

  it('credits and links to the original project', () => {
    const sourceLink = document.querySelector<HTMLAnchorElement>(
      'a[href="https://github.com/kkchengaf/Minecraft-Enchantment-Order-Calculator"]',
    );
    expect(document.querySelector('footer')?.textContent).toContain('kkchengaf');
    expect(sourceLink?.textContent).toContain('View source project');
  });

  it('switches to advanced mode and adds inputs', () => {
    change(document.querySelector<HTMLInputElement>('input[name="mode"][value="advanced"]')!);
    expect(document.querySelectorAll('.input-card')).toHaveLength(1);
    document.querySelector<HTMLButtonElement>('[data-action="add-input"]')?.click();
    expect(document.querySelectorAll('.input-card')).toHaveLength(2);
  });

  it('limits additional inputs to books or the base item', () => {
    change(document.querySelector<HTMLInputElement>('input[name="mode"][value="advanced"]')!);
    change(document.querySelector<HTMLSelectElement>('[data-action="set-input-item"]')!, 'sword');
    document.querySelector<HTMLButtonElement>('[data-action="add-input"]')?.click();

    const inputs = document.querySelectorAll<HTMLSelectElement>('[data-action="set-input-item"]');
    expect(Array.from(inputs[0]!.options).some(option => option.value === 'axe')).toBe(true);
    expect(Array.from(inputs[1]!.options).map(option => option.value)).toEqual(['sword', 'enchanted_book']);
  });

  it('locks the output and book enchantments to the base item', () => {
    change(document.querySelector<HTMLInputElement>('input[name="mode"][value="advanced"]')!);
    change(document.querySelector<HTMLSelectElement>('[data-action="set-input-item"]')!, 'helmet');
    document.querySelector<HTMLButtonElement>('[data-action="add-input"]')?.click();

    const output = document.querySelector<HTMLSelectElement>('[data-action="set-output-item"]')!;
    expect(output.value).toBe('helmet');
    expect(output.disabled).toBe(true);

    const bookEditor = document.querySelectorAll<HTMLSelectElement>('[data-action="add-enchantment"]')[1]!;
    const labels = Array.from(bookEditor.options).map(option => option.textContent);
    expect(labels).toContain('Respiration');
    expect(labels).not.toContain('Sharpness');
  });

  it('sorts enchantments alphabetically', () => {
    const editor = document.querySelector<HTMLSelectElement>('[data-action="add-enchantment"]')!;
    const labels = Array.from(editor.options)
      .slice(1)
      .map(option => option.textContent ?? '');
    expect(labels).toEqual([...labels].sort((left, right) => left.localeCompare(right)));
  });

  it('groups input and output items by category and alphabetizes each group', () => {
    change(document.querySelector<HTMLInputElement>('input[name="mode"][value="advanced"]')!);
    const selectors = [
      document.querySelector<HTMLSelectElement>('[data-action="set-input-item"]')!,
      document.querySelector<HTMLSelectElement>('[data-action="set-output-item"]')!,
    ];

    for (const selector of selectors) {
      const groups = Array.from(selector.querySelectorAll('optgroup'));
      expect(groups.map(group => group.label)).toEqual(['Armor', 'Weapons', 'Tools', 'Utility', 'Books']);
      for (const group of groups) {
        const labels = Array.from(group.querySelectorAll('option')).map(option => option.textContent ?? '');
        expect(labels).toEqual([...labels].sort((left, right) => left.localeCompare(right)));
      }
    }
  });

  it('sets a quantity for identical enchanted books', () => {
    change(document.querySelector<HTMLInputElement>('input[name="mode"][value="advanced"]')!);
    const quantity = document.querySelector<HTMLSelectElement>('[data-action="set-input-quantity"]')!;
    expect(quantity.options.item(quantity.options.length - 1)?.value).toBe('24');
    change(quantity, '4');
    expect(document.querySelector('.input-card h3')?.textContent).toContain('× 4');
  });

  it('explains how to determine prior work penalty', () => {
    change(document.querySelector<HTMLInputElement>('input[name="mode"][value="advanced"]')!);
    const priorWork = document.querySelector('[data-action="set-prior-work"]')?.closest('label');
    expect(priorWork?.textContent).toContain('Prior work penalty (PWP)');
    expect(priorWork?.textContent).toContain('anvil cost to rename this item − 1');
  });

  it('places the add-input control after the input cards', () => {
    change(document.querySelector<HTMLInputElement>('input[name="mode"][value="advanced"]')!);
    const list = document.querySelector('.input-list')!;
    const button = document.querySelector('[data-action="add-input"]')!;
    expect(list.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
