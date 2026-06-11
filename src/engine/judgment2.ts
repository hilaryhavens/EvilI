// src/engine/judgment2.ts
import type { EvidenceHit, MoralityResult, ReliabilityResult } from './types';
import { clamp } from './types';

// Signal weights per the spec: S1 hedging = 1; S2, S3, S4 = 2.
const W1 = 1, W2 = 2, W3 = 2, W4 = 2;
// Density scaling: a weighted-hit density of 10 per 1000 words = full penalty contribution.
const DENSITY_SCALE = 10;

export function scoreReliability(
  hits: EvidenceHit[],
  recognizedWordCount: number,
  morality: MoralityResult,
): ReliabilityResult {
  const per1k = (signals: EvidenceHit['signal'][]) =>
    (hits.filter((h) => signals.includes(h.signal)).reduce((a, h) => a + h.weight, 0) /
      Math.max(recognizedWordCount, 1)) * 1000;

  const s1 = per1k(['hedging']);
  const s2 = per1k(['justification']);
  const s4 = per1k(['retraction', 'contradiction']);
  const s3 = Math.max(0, morality.selfPresentation - morality.deeds) / 2; // 0..100

  const penalty =
    (W1 * Math.min(s1 * DENSITY_SCALE, 100) +
     W2 * Math.min(s2 * DENSITY_SCALE, 100) +
     W4 * Math.min(s4 * DENSITY_SCALE, 100) +
     W3 * s3) / (W1 + W2 + W3 + W4);

  return { index: clamp(100 - penalty, 0, 100), signals: { s1, s2, s3, s4 } };
}
