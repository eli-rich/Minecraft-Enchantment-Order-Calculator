import { describe, expect, it } from 'vitest';
import { getEditionMultiplier, getLevelCost } from '../../src/calculator/rules';

describe('edition rules', () => {
  it('uses final level cost in Java and level difference in Bedrock', () => {
    expect(getLevelCost('java', 2, 4)).toBe(4);
    expect(getLevelCost('bedrock', 2, 4)).toBe(2);
  });

  it('applies the legacy Bedrock Impaling multiplier', () => {
    expect(getEditionMultiplier('bedrock', 29)).toBe(0.5);
    expect(getEditionMultiplier('java', 29)).toBe(1);
  });
});
