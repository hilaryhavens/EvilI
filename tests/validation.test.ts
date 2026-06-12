// tests/validation.test.ts
//
// Corpus scores recorded 2026-06-11 (methodology v0.1.0):
//   Moll Flanders  — reliability: 83.0  deeds: 13.9  selfPresentation: 33.3
//   Plague Year    — reliability: 90.7  deeds: 30.8  selfPresentation:  6.6
//   Pamela         — reliability: 86.7  deeds: 49.3  selfPresentation: 30.8
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { analyze } from '../src/engine/engine';
import type { AnalysisReport } from '../src/engine/types';

const path = (f: string) => `public/corpus/${f}`;
const haveCorpus = ['moll-flanders.txt', 'plague-year.txt', 'pamela.txt']
  .every((f) => existsSync(path(f)));

describe.skipIf(!haveCorpus)('validation against critical consensus', () => {
  const load = (f: string, title: string): AnalysisReport =>
    analyze(readFileSync(path(f), 'utf-8'), title);

  // these are long novels; analysis is slow — share reports across assertions
  const moll = load('moll-flanders.txt', 'Moll Flanders');
  const plague = load('plague-year.txt', 'Plague Year');
  const pamela = load('pamela.txt', 'Pamela');

  it('every bundled text registers as first-person (or epistolary)', () => {
    for (const r of [moll, plague, pamela]) {
      expect(['first-person', 'mixed-epistolary']).toContain(r.perspective.verdict);
    }
  });
  it('Moll Flanders is less reliable than the Journal of the Plague Year', () => {
    expect(moll.reliability!.index).toBeLessThan(plague.reliability!.index);
  });
  it("Moll's deeds score sits below her self-presentation score", () => {
    expect(moll.morality!.deeds).toBeLessThan(moll.morality!.selfPresentation);
  });
  it("Pamela's deed/word gap is smaller than Moll's", () => {
    const gap = (r: AnalysisReport) =>
      Math.max(0, r.morality!.selfPresentation - r.morality!.deeds);
    expect(gap(pamela)).toBeLessThan(gap(moll));
  });
}, 300_000);
