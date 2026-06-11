// tests/engine/engine.test.ts
import { describe, it, expect } from 'vitest';
import { analyze } from '../../src/engine/engine';

const FP_VICIOUS = `CHAPTER I
I was an honest woman, the reader must believe, and ever virtuous.
But I stole a gold watch from the gentleman, and I robbed the child of her necklace.
I cheated the mercer and deceived my husband; I was driven by necessity, let none judge me.
CHAPTER II
I pretended I was a gentlewoman of fortune; but in truth I had nothing.
I stole again from the shops, yet I was ever an innocent and pious creature.`;

const TP = `She walked to town. He followed her. They spoke of the weather and their friends.
He thought her agreeable; she found him dull. Their acquaintance continued for some years.`;

describe('analyze', () => {
  it('produces a full report for a first-person text', () => {
    const r = analyze(FP_VICIOUS, 'Test Narrative');
    expect(r.perspective.verdict).toBe('first-person');
    expect(r.reliability).not.toBeNull();
    expect(r.morality).not.toBeNull();
    expect(r.morality!.deeds).toBeLessThan(0);
    expect(r.morality!.selfPresentation).toBeGreaterThan(r.morality!.deeds);
    expect(r.reliability!.index).toBeLessThan(70);
    expect(r.evidence.length).toBeGreaterThan(4);
    expect(r.segments.length).toBe(2);
    expect(r.methodologyVersion).toBeTruthy();
  });
  it('stops after Judgment 1 for third-person texts', () => {
    const r = analyze(TP, 'Third Person');
    expect(r.perspective.verdict).toBe('third-person');
    expect(r.reliability).toBeNull();
    expect(r.morality).toBeNull();
    expect(r.evidence).toHaveLength(0);
  });
  it('reports OCR quality', () => {
    const r = analyze('fhe ' + FP_VICIOUS, 'OCR Test');
    expect(r.ocr.corrections.length).toBeGreaterThan(0);
  });
  it('assigns evidence to the right segment', () => {
    const r = analyze(FP_VICIOUS, 'Segments');
    const ch2Hits = r.evidence.filter(h => h.segmentIndex === 1);
    expect(ch2Hits.length).toBeGreaterThan(0);
  });
});
