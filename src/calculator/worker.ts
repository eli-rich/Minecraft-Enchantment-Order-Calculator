/// <reference lib="webworker" />

import { searchAdvanced } from './search';
import type { WorkerSearchRequest, WorkerSearchResponse } from './types';

const worker = self as DedicatedWorkerGlobalScope;

worker.addEventListener('message', (event: MessageEvent<WorkerSearchRequest>) => {
  if (event.data.type !== 'search') return;

  try {
    const result = searchAdvanced(event.data.items, {
      ...event.data.options,
      onProgress: (current, total, candidates) => {
        const message: WorkerSearchResponse = { type: 'progress', current, total, candidates };
        worker.postMessage(message);
      },
    });
    const message: WorkerSearchResponse = { type: 'result', result };
    worker.postMessage(message);
  } catch (error) {
    const message: WorkerSearchResponse = {
      type: 'error',
      message: error instanceof Error ? error.message : 'The search failed unexpectedly.',
    };
    worker.postMessage(message);
  }
});
