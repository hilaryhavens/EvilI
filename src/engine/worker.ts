// src/engine/worker.ts
import { analyze } from './engine';

self.onmessage = (e: MessageEvent<{ id: number; text: string; title: string }>) => {
  const { id, text, title } = e.data;
  try {
    const report = analyze(text, title);
    // processedText can be huge; it transfers fine via structured clone
    (self as unknown as Worker).postMessage({ id, ok: true, report });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: String(err) });
  }
};
