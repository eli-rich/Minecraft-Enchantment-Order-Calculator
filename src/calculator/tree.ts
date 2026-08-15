import type { Edition, EnchantmentLevels } from '../types';
import { combineAnvilComponents, componentFromSearchItem, componentSatisfiesGoal } from './anvil';
import type { EvaluatedTree, NodeValue, ResultNode, SearchItem, TreeStructure } from './types';

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

    if (!this.invalid && !componentSatisfiesGoal({ enchant: rootValue.enchant, workCount: rootValue.height }, goal)) {
      this.invalid = true;
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

      const component = componentFromSearchItem(item);
      const value: NodeValue = {
        cost: item.cost,
        enchant: component.enchant,
        height: component.workCount,
      };
      node.value = value;
      return value;
    }

    const left = this.evaluateNode(node.left, items);
    const right = this.evaluateNode(node.right, items);

    const combination = combineAnvilComponents(
      { enchant: left.enchant, workCount: left.height },
      { enchant: right.enchant, workCount: right.height },
      this.edition,
      this.allowLegacyConflicts,
    );
    if (!combination) {
      this.invalid = true;
      return { cost: 0, enchant: {}, height: 0 };
    }

    this.enchantmentCost += combination.enchantmentCost;
    this.priorWorkCost += combination.priorWorkCost;
    const value: NodeValue = {
      cost: combination.enchantmentCost,
      enchant: combination.component.enchant,
      height: combination.component.workCount,
      prior: combination.priorWorkCost,
    };
    node.value = value;
    return value;
  }
}
