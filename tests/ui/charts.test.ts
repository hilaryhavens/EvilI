// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { lineChartSvg, scatterSvg } from '../../src/ui/charts';

describe('lineChartSvg', () => {
  it('renders an SVG with one polyline per series and a title', () => {
    const svg = lineChartSvg({
      title: 'Narrative arc — Test',
      labels: ['Ch 1', 'Ch 2', 'Ch 3'],
      series: [
        { name: 'Reliability', color: '#1d6fa5', values: [80, 60, 40] },
        { name: 'Deeds', color: '#b45309', values: [10, -30, -70] },
      ],
      yMin: -100, yMax: 100,
    });
    expect(svg).toContain('<svg');
    expect((svg.match(/<polyline/g) ?? []).length).toBe(2);
    expect(svg).toContain('Narrative arc — Test');
  });
});

describe('scatterSvg', () => {
  it('renders a circle per point and a diagonal reference line', () => {
    const svg = scatterSvg({
      title: 'Deeds vs self-presentation',
      points: [{ label: 'Moll', x: -60, y: 40 }, { label: 'Pamela', x: 50, y: 60 }],
    });
    expect((svg.match(/<circle/g) ?? []).length).toBe(2);
    expect(svg).toContain('<line');
  });
});
