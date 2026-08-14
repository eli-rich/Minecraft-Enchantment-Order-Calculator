import { describe, expect, it } from 'vitest';
import { catalog, ITEM_CATEGORIES, itemsForEdition } from '../../src/data/catalog';

describe('catalog', () => {
  it('has unique enchantment IDs and keys', () => {
    expect(new Set(catalog.enchantments.map(enchantment => enchantment.id)).size).toBe(catalog.enchantments.length);
    expect(new Set(catalog.enchantments.map(enchantment => enchantment.key)).size).toBe(catalog.enchantments.length);
  });

  it('has unique item keys and valid enchantment references', () => {
    expect(new Set(catalog.items.map(item => item.key)).size).toBe(catalog.items.length);
    for (const item of catalog.items) {
      expect(item.enchantments.every(id => catalog.enchantmentById.has(id))).toBe(true);
    }
  });

  it('assigns every item to a supported category and sorts within categories', () => {
    const categoryKeys = ITEM_CATEGORIES.map(category => category.key);
    for (const item of catalog.items) expect(categoryKeys).toContain(item.category);

    for (const category of ITEM_CATEGORIES) {
      const labels = itemsForEdition('java')
        .filter(item => item.category === category.key)
        .map(item => item.label);
      expect(labels).toEqual([...labels].sort((left, right) => left.localeCompare(right)));
    }
  });

  it('has symmetric conflict references', () => {
    for (const enchantment of catalog.enchantments) {
      for (const conflictId of enchantment.conflicts) {
        expect(catalog.enchantmentById.get(conflictId)?.conflicts).toContain(enchantment.id);
      }
    }
  });

  it('marks Sweeping Edge as Java-only', () => {
    expect(catalog.enchantmentById.get(1000)?.editions).toEqual(['java']);
  });

  it('has valid levels, costs, and edition support', () => {
    for (const enchantment of catalog.enchantments) {
      expect(enchantment.maxLevel).toBeGreaterThan(0);
      expect(enchantment.costs.book).toBeGreaterThan(0);
      expect(enchantment.costs.item).toBeGreaterThan(0);
      expect(enchantment.editions.length).toBeGreaterThan(0);
    }
    for (const item of catalog.items) expect(item.editions.length).toBeGreaterThan(0);
  });
});
