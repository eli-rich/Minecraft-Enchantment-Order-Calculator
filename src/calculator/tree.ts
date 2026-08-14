import type { Edition, EnchantmentLevels } from '../types';
import {
  getConflicts,
  getEditionMultiplier,
  getEnchantmentCost,
  getLevelCost,
  getMaximumLevel,
  isLegacyConflict,
  isValidForItem,
  PRIOR_WORK_COSTS,
  sourceType,
} from './rules';
import type { EvaluatedTree, NodeValue, ResultNode, SearchEnchantments, SearchItem, TreeStructure } from './types';

const enchantmentIds = (enchantments: SearchEnchantments) =>
  Object.keys(enchantments)
    .filter(key => key !== 'item' && key !== 'prior')
    .map(Number);

const cloneEnchantments = (enchantments: SearchEnchantments): SearchEnchantments => ({ ...enchantments });

export class TreeEvaluator {
  private itemIndex = 0;
  private enchantmentCost = 0;
  private priorWorkCost = 0;
  private invalid = false;

  constructor(
    private readonly structure: TreeStructure,
    private readonly edition: Edition,
    private readonly allowLegacyConflicts: boolean,
  ) {}

  evaluate(items: SearchItem[], goal?: EnchantmentLevels): EvaluatedTree {
    this.itemIndex = 0;
    this.enchantmentCost = 0;
    this.priorWorkCost = 0;
    this.invalid = false;

    const root = this.parseStructure(this.structure);
    const rootValue = this.evaluateNode(root, items);

    if (!this.invalid && goal) {
      for (const [id, level] of Object.entries(goal)) {
        if (Number(rootValue.enchant[Number(id)] ?? 0) < level) this.invalid = true;
      }
    }

    return {
      root,
      enchantmentCost: this.enchantmentCost + (this.invalid ? 100_000 : 0),
      priorWorkCost: this.priorWorkCost,
      invalid: this.invalid,
    };
  }

  private parseStructure(structure: TreeStructure): ResultNode {
    if (typeof structure === 'number') return { left: null, right: null, value: structure };
    if (structure.length === 1) return this.parseStructure(structure[0]);

    return {
      left: this.parseStructure(structure[0]),
      right: this.parseStructure(structure[1]),
      value: 0,
    };
  }

  private evaluateNode(node: ResultNode, items: SearchItem[]): NodeValue {
    if (this.invalid) return { cost: 0, enchant: {}, height: 0 };

    if (!node.left || !node.right) {
      const item = items[this.itemIndex++];
      if (!item) {
        this.invalid = true;
        return { cost: 0, enchant: {}, height: 0 };
      }

      const priorIndex = item.enchant.prior
        ? PRIOR_WORK_COSTS.findIndex(cost => cost === item.enchant.prior)
        : 0;
      const value: NodeValue = {
        cost: item.cost,
        enchant: cloneEnchantments(item.enchant),
        height: Math.max(priorIndex, 0),
      };
      node.value = value;
      return value;
    }

    const left = this.evaluateNode(node.left, items);
    const right = this.evaluateNode(node.right, items);

    if (!left.enchant.item && right.enchant.item) {
      this.invalid = true;
      return { cost: 0, enchant: {}, height: 0 };
    }

    const enchant = this.combine(left.enchant, right.enchant);
    const height = Math.max(left.height, right.height) + 1;
    const prior = (PRIOR_WORK_COSTS[left.height] ?? 0) + (PRIOR_WORK_COSTS[right.height] ?? 0);
    this.priorWorkCost += prior;

    const value: NodeValue = { cost: enchant.cost, enchant: enchant.value, height, prior };
    node.value = value;
    return value;
  }

  private combine(left: SearchEnchantments, originalRight: SearchEnchantments) {
    const right = cloneEnchantments(originalRight);
    const result: SearchEnchantments = {};
    let cost = 0;

    if (left.item) {
      for (const id of enchantmentIds(right)) {
        if (!isValidForItem(left.item, id)) delete right[id];
      }
    }

    for (const id of enchantmentIds(left)) {
      if (right[id] === undefined) result[id] = left[id];
    }

    for (const id of enchantmentIds(right)) {
      const rightLevel = Number(right[id]);
      const leftLevel = Number(left[id] ?? 0);
      const conflictingId = getConflicts(id).find(conflictId => left[conflictId] !== undefined);
      const ignoreLegacyConflict =
        this.allowLegacyConflicts && conflictingId !== undefined && isLegacyConflict(id, conflictingId);

      if (conflictingId !== undefined && !ignoreLegacyConflict) {
        if (this.edition === 'java') cost += 1;
        continue;
      }

      const finalLevel =
        leftLevel === rightLevel
          ? Math.min(getMaximumLevel(id), leftLevel + 1)
          : Math.max(leftLevel, rightLevel);
      const multiplier = getEnchantmentCost(id, sourceType(right));
      cost += getLevelCost(this.edition, leftLevel, finalLevel) * multiplier * getEditionMultiplier(this.edition, id);
      result[id] = finalLevel;
    }

    if (left.item) result.item = left.item;
    this.enchantmentCost += cost;
    return { cost, value: result };
  }
}
