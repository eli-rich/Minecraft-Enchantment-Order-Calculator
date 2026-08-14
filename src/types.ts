export type Edition = 'java' | 'bedrock';

export type SearchMode = 'books' | 'advanced';

export interface EnchantmentDefinition {
  id: number;
  key: string;
  label: string;
  maxLevel: number;
  costs: {
    item: number;
    book: number;
  };
  conflicts: number[];
  editions: Edition[];
}

export interface ItemDefinition {
  key: string;
  label: string;
  enchantments: number[];
  editions: Edition[];
}

export interface CatalogData {
  enchantments: EnchantmentDefinition[];
  items: ItemDefinition[];
}

export type EnchantmentLevels = Record<number, number>;

export interface InputItem {
  id: string;
  item: string;
  enchantments: EnchantmentLevels;
  quantity: number;
  priorWork: number;
  bypassed: boolean;
}

export interface OutputGoal {
  item: string;
  enchantments: EnchantmentLevels;
}

export interface CalculatorState {
  version: 2;
  edition: Edition;
  mode: SearchMode;
  allowLegacyConflicts: boolean;
  guideCollapsed: boolean;
  inputs: InputItem[];
  output: OutputGoal;
}
