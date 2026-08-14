import { appendStateToPng } from './persistence';
import type { DisplayResult } from './results';
import type { CalculatorState } from '../types';

const canvasToBlob = (canvas: HTMLCanvasElement) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Unable to create the result image.'))),
      'image/png',
    );
  });

const drawWrappedText = (
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) => {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (const word of words) {
    const next = `${line}${word} `;
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line.trim(), x, currentY);
      currentY += lineHeight;
      line = `${word} `;
    } else {
      line = next;
    }
  }
  if (line) context.fillText(line.trim(), x, currentY);
  return currentY + lineHeight;
};

export const createResultImage = async (result: DisplayResult, state: CalculatorState) => {
  const width = 1100;
  const lineHeight = 25;
  const estimatedLines = 7 + result.steps.length * 5;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.max(420, estimatedLines * lineHeight + 80);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas is not supported by this browser.');

  context.fillStyle = '#f4f1e8';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#243126';
  context.font = 'bold 28px system-ui, sans-serif';
  context.fillText('Minecraft Enchantment Order', 48, 52);
  context.font = '16px ui-monospace, monospace';
  context.fillStyle = '#526055';
  context.fillText(`${state.edition === 'java' ? 'Java' : 'Bedrock'} Edition`, 48, 82);
  context.fillStyle = '#243126';
  context.font = 'bold 20px system-ui, sans-serif';
  context.fillText(`Total cost: ${result.totalCost} levels`, 48, 120);
  context.font = '15px ui-monospace, monospace';
  context.fillText(`Enchantment ${result.search.enchantmentCost} + prior work ${result.search.priorWorkCost}`, 48, 148);

  let y = 195;
  for (const step of result.steps) {
    context.fillStyle = '#557a46';
    context.font = 'bold 18px system-ui, sans-serif';
    context.fillText(`Step ${step.number} · ${step.cost} levels`, 48, y);
    context.fillStyle = '#243126';
    context.font = '15px ui-monospace, monospace';
    y = drawWrappedText(context, `Left: ${step.left}`, 72, y + 28, width - 120, lineHeight);
    y = drawWrappedText(context, `Right: ${step.right}`, 72, y, width - 120, lineHeight);
    y = drawWrappedText(context, `Result: ${step.result}`, 72, y, width - 120, lineHeight) + 12;
  }

  context.fillStyle = '#6b756d';
  context.font = '14px system-ui, sans-serif';
  context.fillText(
    `Drop this image onto ${window.location.origin} to restore the calculation.`,
    48,
    canvas.height - 32,
  );

  return appendStateToPng(await canvasToBlob(canvas), state);
};

export const downloadBlob = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
};
