// src/engine/judgment3.ts
import type { EvidenceHit, MoralityResult } from './types';
import { moralBand } from './types';

function polarity(positive: number, negative: number): number {
  const total = positive + negative;
  if (total === 0) return 0;
  const raw = (100 * (positive - negative)) / total;
  return raw * Math.min(1, total / 10); // dampen tiny-evidence scores
}

export function scoreMorality(hits: EvidenceHit[]): MoralityResult {
  const sum = (signal: EvidenceHit['signal']) =>
    hits.filter((h) => h.signal === signal).reduce((a, h) => a + h.weight, 0);

  const deeds = polarity(sum('virtueDeed'), sum('viceDeed'));
  const selfPresentation = polarity(sum('selfVirtue'), sum('selfVice'));

  return {
    deeds, selfPresentation,
    deedsBand: moralBand(deeds),
    selfPresentationBand: moralBand(selfPresentation),
  };
}
