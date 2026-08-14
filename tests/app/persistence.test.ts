// @vitest-environment node

import { describe, expect, it } from 'vitest';
import { appendStateToPng, findPngPayloadOffset, readStateFromPng } from '../../src/app/persistence';
import { createDefaultState } from '../../src/app/state';

const minimalPng = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 73, 69, 78, 68, 174, 66, 96, 130]);

describe('PNG persistence', () => {
  it('finds the PNG end marker', () => {
    expect(findPngPayloadOffset(minimalPng)).toBe(minimalPng.length);
  });

  it('round-trips versioned calculator state', async () => {
    const state = { ...createDefaultState(), edition: 'java' as const };
    const image = await appendStateToPng(new Blob([minimalPng], { type: 'image/png' }), state);
    await expect(readStateFromPng(image)).resolves.toMatchObject({ version: 2, edition: 'java' });
  });

  it('reads legacy calculator payloads', async () => {
    const legacy = new TextEncoder().encode(JSON.stringify({ inputs: [], output: { item: 'boots', 2: 4 } }));
    const bytes = new Uint8Array(minimalPng.length + legacy.length);
    bytes.set(minimalPng);
    bytes.set(legacy, minimalPng.length);
    await expect(readStateFromPng(new Blob([bytes]))).resolves.toMatchObject({
      edition: 'bedrock',
      output: { item: 'boots', enchantments: { 2: 4 } },
    });
  });
});
