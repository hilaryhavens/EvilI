// src/engine/judgment2.ts
import type { EvidenceHit, MoralityResult, ReliabilityResult } from './types';
import { clamp } from './types';

// Signal weights (methodology v0.2.0). The deed/self-presentation gap (S3) is the
// most direct operationalization of an unreliable narrator — being other than one
// presents oneself — so it carries the most weight. Self-justification (S2) and
// contradiction (S4) are moderate. Hedging (S1) is weakest: qualifying one's memory
// is a mark of honesty as often as of unreliability, so it barely moves the index.
const W1 = 1, W2 = 2, W3 = 4, W4 = 2;
// Density scaling: a weighted-hit density of 10 per 1000 words = full contribution.
const DENSITY_SCALE = 10;
// Global penalty sensitivity. The v0.1.0 model averaged the signal contributions,
// leaving genuinely unreliable narrators scoring ~85. This amplifies real evidence
// while leaving a no-evidence text at index 100. Tuned so the reliable control
// (Clarissa Harlowe's own letters) stays >= 60; see tests/corpus-validation.test.ts.
const SENSITIVITY = 3.7;

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

  const penalty = SENSITIVITY *
    (W1 * Math.min(s1 * DENSITY_SCALE, 100) +
     W2 * Math.min(s2 * DENSITY_SCALE, 100) +
     W4 * Math.min(s4 * DENSITY_SCALE, 100) +
     W3 * s3) / (W1 + W2 + W3 + W4);

  return { index: clamp(100 - penalty, 0, 100), signals: { s1, s2, s3, s4 } };
}
