import { normalizeState } from './state';
import type { CalculatorState } from '../types';

const PNG_END = new Uint8Array([73, 69, 78, 68, 174, 66, 96, 130]);

export const findPngPayloadOffset = (bytes: Uint8Array) => {
  for (let index = bytes.length - PNG_END.length; index >= 0; index -= 1) {
    if (PNG_END.every((byte, offset) => bytes[index + offset] === byte)) return index + PNG_END.length;
  }
  return -1;
};

export const appendStateToPng = async (png: Blob, state: CalculatorState) => {
  const image = new Uint8Array(await png.arrayBuffer());
  const payload = new TextEncoder().encode(JSON.stringify(state));
  const combined = new Uint8Array(image.length + payload.length);
  combined.set(image);
  combined.set(payload, image.length);
  return new Blob([combined], { type: 'image/png' });
};

export const readStateFromPng = async (file: Blob) => {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const offset = findPngPayloadOffset(bytes);
  if (offset < 0 || offset === bytes.length) throw new Error('This PNG does not contain calculator data.');

  try {
    return normalizeState(JSON.parse(new TextDecoder().decode(bytes.slice(offset))));
  } catch {
    throw new Error('The calculator data in this PNG is invalid.');
  }
};
