// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { renderComparison } from '../../src/ui/comparisonView';
import { analyze } from '../../src/engine/engine';

const A = analyze('I stole the purse and I cheated him; but in truth I was driven by necessity. I was ever honest.', 'Thief');
const B = analyze('I prayed daily and I gave alms to the poor; I laboured with diligence and thanked God.', 'Saint');

describe('renderComparison', () => {
  it('renders one row per text with scores', () => {
    const el = document.createElement('div');
    renderComparison(el, [A, B], () => {});
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.textContent).toContain('Thief');
    expect(el.textContent).toContain('Saint');
  });
  it('sorts by clicked column', () => {
    const el = document.createElement('div');
    renderComparison(el, [A, B], () => {});
    (el.querySelector('th[data-key="deeds"]') as HTMLElement).click();
    const firstRow = el.querySelector('tbody tr')!;
    expect(firstRow.textContent).toContain('Thief'); // ascending: most immoral first
  });
});
