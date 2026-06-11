// tests/engine/judgment2.test.ts
import { describe, it, expect } from 'vitest';
import { scoreReliability } from '../../src/engine/judgment2';
import type { EvidenceHit, MoralityResult } from '../../src/engine/types';

const hit = (signal: EvidenceHit['signal'], weight = 2): EvidenceHit => ({
  signal, term: 't', sentence: 's', charStart: 0, charEnd: 1, segmentIndex: 0, weight,
});
const neutralMorality: MoralityResult = {
  deeds: 0, selfPresentation: 0, deedsBand: 'ambiguous', selfPresentationBand: 'ambiguous',
};

describe('scoreReliability', () => {
  it('gives a clean text a high index', () => {
    const r = scoreReliability([], 5000, neutralMorality);
    expect(r.index).toBeGreaterThan(90);
  });
  it('penalizes justification more than the same density of hedging', () => {
    const hedgy = scoreReliability(Array(20).fill(hit('hedging')), 5000, neutralMorality);
    const justifying = scoreReliability(Array(20).fill(hit('justification')), 5000, neutralMorality);
    expect(justifying.index).toBeLessThan(hedgy.index);
  });
  it('penalizes the deed/word gap (pious talk, vicious deeds)', () => {
    const hypocrite: MoralityResult = {
      deeds: -70, selfPresentation: 50, deedsBand: 'immoral', selfPresentationBand: 'mostly virtuous',
    };
    const r = scoreReliability([], 5000, hypocrite);
    expect(r.signals.s3).toBeCloseTo(60); // (50 - -70) / 2
    expect(r.index).toBeLessThan(scoreReliability([], 5000, neutralMorality).index);
  });
  it('does not reward virtue gaps in the other direction', () => {
    const humble: MoralityResult = {
      deeds: 50, selfPresentation: -20, deedsBand: 'mostly virtuous', selfPresentationBand: 'ambiguous',
    };
    expect(scoreReliability([], 5000, humble).signals.s3).toBe(0);
  });
  it('clamps to 0..100', () => {
    const r = scoreReliability(Array(500).fill(hit('retraction', 3)), 1000, neutralMorality);
    expect(r.index).toBeGreaterThanOrEqual(0);
  });
});
