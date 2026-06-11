// tests/engine/judgment3.test.ts
import { describe, it, expect } from 'vitest';
import { scoreMorality } from '../../src/engine/judgment3';
import type { EvidenceHit } from '../../src/engine/types';

const hit = (signal: EvidenceHit['signal'], weight = 2): EvidenceHit => ({
  signal, term: 't', sentence: 's', charStart: 0, charEnd: 1, segmentIndex: 0, weight,
});

describe('scoreMorality', () => {
  it('scores all-vice deeds strongly negative', () => {
    const m = scoreMorality(Array(10).fill(hit('viceDeed', 3)));
    expect(m.deeds).toBeLessThan(-60);
    expect(m.deedsBand).toBe('immoral');
  });
  it('scores all-virtue deeds strongly positive', () => {
    const m = scoreMorality(Array(10).fill(hit('virtueDeed', 3)));
    expect(m.deeds).toBeGreaterThan(60);
  });
  it('scores mixed evidence near zero', () => {
    const m = scoreMorality([...Array(5).fill(hit('viceDeed')), ...Array(5).fill(hit('virtueDeed'))]);
    expect(Math.abs(m.deeds)).toBeLessThan(20);
  });
  it('dampens scores from very little evidence', () => {
    const m = scoreMorality([hit('viceDeed', 3)]);
    expect(m.deeds).toBeGreaterThan(-40); // one hit should not yield "immoral"
  });
  it('computes self-presentation independently of deeds', () => {
    const m = scoreMorality([
      ...Array(10).fill(hit('viceDeed', 3)),
      ...Array(10).fill(hit('selfVirtue', 2)),
    ]);
    expect(m.deeds).toBeLessThan(-60);
    expect(m.selfPresentation).toBeGreaterThan(40);
  });
});
