// src/ui/comparisonView.ts
import type { AnalysisReport } from '../engine/types';
import { scatterSvg, chartExportButtons, wireChartExport } from './charts';

interface Row {
  report: AnalysisReport; title: string; perspective: string;
  reliability: number; deeds: number; selfPresentation: number;
  gap: number; words: number; ocr: number;
}

const COLS: { key: keyof Row; label: string }[] = [
  { key: 'title', label: 'Text' }, { key: 'perspective', label: 'Perspective' },
  { key: 'reliability', label: 'Reliability' }, { key: 'deeds', label: 'Deeds' },
  { key: 'selfPresentation', label: 'Self-presentation' }, { key: 'gap', label: 'Gap' },
  { key: 'words', label: 'Words' }, { key: 'ocr', label: 'OCR noise %' },
];

export function renderComparison(
  root: HTMLElement,
  reports: AnalysisReport[],
  onSelect: (r: AnalysisReport) => void,
): void {
  const rows: Row[] = reports.map((r) => ({
    report: r, title: r.title, perspective: r.perspective.verdict,
    reliability: r.reliability?.index ?? NaN,
    deeds: r.morality?.deeds ?? NaN,
    selfPresentation: r.morality?.selfPresentation ?? NaN,
    gap: r.morality ? Math.max(0, r.morality.selfPresentation - r.morality.deeds) : NaN,
    words: r.wordCount, ocr: r.ocr.unknownTokenRate * 100,
  }));

  let sortKey: keyof Row = 'reliability';
  let asc = true;

  const draw = () => {
    const sorted = [...rows].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      const cmp = typeof av === 'string'
        ? String(av).localeCompare(String(bv))
        : (Number(av) || 0) - (Number(bv) || 0);
      return asc ? cmp : -cmp;
    });
    root.innerHTML = `
      <h3>Comparison — ${rows.length} texts</h3>
      <table class="comparison"><thead><tr>
        ${COLS.map((c) => `<th data-key="${c.key}">${c.label}</th>`).join('')}
      </tr></thead><tbody>
        ${sorted.map((r, i) => `<tr data-i="${i}">
          <td>${esc(r.title)}</td><td>${r.perspective}</td>
          <td>${fmt(r.reliability)}</td><td>${fmt(r.deeds)}</td>
          <td>${fmt(r.selfPresentation)}</td><td>${fmt(r.gap)}</td>
          <td>${r.words.toLocaleString()}</td><td>${r.ocr.toFixed(1)}</td>
        </tr>`).join('')}
      </tbody></table>
      <div id="comparison-scatter"></div>`;

    root.querySelectorAll('th').forEach((th) => th.addEventListener('click', () => {
      const k = th.dataset.key as keyof Row;
      if (k === sortKey) asc = !asc; else { sortKey = k; asc = true; }
      draw();
    }));
    root.querySelectorAll('tbody tr').forEach((tr) => tr.addEventListener('click', () => {
      onSelect(sorted[Number((tr as HTMLElement).dataset.i)].report);
    }));

    const scatterPoints = rows.filter((r) => !Number.isNaN(r.deeds));
    if (scatterPoints.length > 1) {
      const svg = scatterSvg({
        title: 'Deeds vs self-presentation (distance from diagonal = hypocrisy gap)',
        points: scatterPoints.map((r) => ({ label: r.title, x: r.deeds, y: r.selfPresentation })),
      });
      const slot = root.querySelector<HTMLElement>('#comparison-scatter')!;
      slot.innerHTML = svg + chartExportButtons('scatter');
      wireChartExport(slot, svg, 'evil-i-comparison-scatter');
    }
  };
  draw();
}

const fmt = (n: number) => Number.isNaN(n) ? '—' : n.toFixed(0);
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
