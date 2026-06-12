// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { showResults } from '../../src/ui/resultsView';
import { analyze } from '../../src/engine/engine';

const FP = `I stole the watch and I robbed the house; I was driven by necessity.
The reader must believe I was ever an honest and pious woman. I know not how it began.`;

describe('showResults', () => {
  const report = analyze(FP, 'Smoke Test');
  it('renders three verdict cards', () => {
    const el = document.createElement('div');
    showResults(el, [report], () => {});
    expect(el.querySelectorAll('.verdict-card').length).toBe(3);
    expect(el.textContent).toContain('first-person');
  });
  it('renders highlighted evidence in the explorer', () => {
    const el = document.createElement('div');
    showResults(el, [report], () => {});
    expect(el.querySelectorAll('mark.evidence').length).toBeGreaterThan(2);
  });
  it('grays out reliability and morality for third-person texts', () => {
    const tp = analyze('She walked out. He saw her. They spoke of their plans together often.', 'TP');
    const el = document.createElement('div');
    showResults(el, [tp], () => {});
    expect(el.querySelectorAll('.verdict-card.disabled').length).toBe(2);
  });
});
