import type { Edition, EnchantmentLevels } from '../types';

export type TreeStructure = number | [TreeStructure] | [TreeStructure, TreeStructure];

export interface SearchEnchantments {
  [key: string]: number | string | undefined;
  item?: string;
  prior?: number;
}

export interface SearchItem {
  cost: number;
  enchant: SearchEnchantments;
}

export interface SearchResult {
  orderedItems: SearchItem[];
  structure: TreeStructure;
  priorWorkCost: number;
  enchantmentCost: number;
  exploredStates?: number;
}

export type SearchPlanNode =
  { kind: 'leaf'; item: SearchItem } | { kind: 'combine'; left: SearchPlanNode; right: SearchPlanNode };

export interface SearchProgress {
  exploredStates: number;
  queuedStates: number;
}

export interface SearchOptions {
  edition: Edition;
  allowLegacyConflicts: boolean;
  goal?: EnchantmentLevels;
  onProgress?: (progress: SearchProgress) => void;
}

export interface NodeValue {
  cost: number;
  enchant: SearchEnchantments;
  height: number;
  prior?: number;
}

export interface ResultNode {
  left: ResultNode | null;
  right: ResultNode | null;
  value: NodeValue | number;
}

export interface EvaluatedTree {
  root: ResultNode;
  enchantmentCost: number;
  priorWorkCost: number;
  invalid: boolean;
}

export interface WorkerSearchRequest {
  type: 'search';
  items: SearchItem[];
  options: Omit<SearchOptions, 'onProgress'>;
}

export type WorkerSearchResponse =
  | ({ type: 'progress' } & SearchProgress)
  | { type: 'result'; result: SearchResult }
  | { type: 'error'; message: string };
