// src/engine/workerClient.ts
import type { AnalysisReport } from './types';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: AnalysisReport) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; report?: AnalysisReport; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok && e.data.report) p.resolve(e.data.report);
      else p.reject(new Error(e.data.error ?? 'analysis failed'));
    };
    // A crash outside the worker's own try/catch (e.g. module load failure)
    // never posts a message; reject everything pending so the UI doesn't hang.
    worker.onerror = (e: ErrorEvent) => {
      for (const p of pending.values()) p.reject(new Error(e.message || 'worker error'));
      pending.clear();
    };
  }
  return worker;
}

export function analyzeInWorker(text: string, title: string): Promise<AnalysisReport> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, text, title });
  });
}
