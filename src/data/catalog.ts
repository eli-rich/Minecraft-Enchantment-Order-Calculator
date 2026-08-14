import rawCatalog from './catalog.json';
import type { CatalogData, Edition, EnchantmentDefinition, ItemCategory, ItemDefinition } from '../types';

export const ITEM_CATEGORIES: ReadonlyArray<{ key: ItemCategory; label: string }> = [
  { key: 'armor', label: 'Armor' },
  { key: 'weapon', label: 'Weapons' },
  { key: 'tool', label: 'Tools' },
  { key: 'utility', label: 'Utility' },
  { key: 'book', label: 'Books' },
];

const itemCategoryIndex = new Map(ITEM_CATEGORIES.map((category, index) => [category.key, index]));

export interface Catalog {
  enchantments: EnchantmentDefinition[];
  items: ItemDefinition[];
  enchantmentById: Map<number, EnchantmentDefinition>;
  itemByKey: Map<string, ItemDefinition>;
}

const catalogData = rawCatalog as CatalogData;

export const catalog: Catalog = {
  ...catalogData,
  enchantmentById: new Map(catalogData.enchantments.map(enchantment => [enchantment.id, enchantment])),
  itemByKey: new Map(catalogData.items.map(item => [item.key, item])),
};

export const enchantmentsForEdition = (edition: Edition) =>
  catalog.enchantments
    .filter(enchantment => enchantment.editions.includes(edition))
    .sort((left, right) => left.label.localeCompare(right.label));

export const itemsForEdition = (edition: Edition) =>
  catalog.items
    .filter(item => item.editions.includes(edition))
    .sort(
      (left, right) =>
        (itemCategoryIndex.get(left.category) ?? ITEM_CATEGORIES.length) -
          (itemCategoryIndex.get(right.category) ?? ITEM_CATEGORIES.length) || left.label.localeCompare(right.label),
    );

export const enchantmentsForItem = (itemKey: string, edition: Edition) => {
  const item = catalog.itemByKey.get(itemKey);
  if (!item) return [];

  return item.enchantments
    .map(id => catalog.enchantmentById.get(id))
    .filter((enchantment): enchantment is EnchantmentDefinition => Boolean(enchantment?.editions.includes(edition)))
    .sort((left, right) => left.label.localeCompare(right.label));
};

export const formatItemLabel = (itemKey: string) => catalog.itemByKey.get(itemKey)?.label ?? itemKey;
