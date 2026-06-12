// src/ui/charts.ts
import type { AnalysisReport } from '../engine/types';
import { METHODOLOGY_VERSION } from '../engine/types';

const W = 720, H = 380, PAD = 50;

export interface LineChartSpec {
  title: string;
  labels: string[];
  series: { name: string; color: string; values: number[] }[];
  yMin: number; yMax: number;
}

export function lineChartSvg(spec: LineChartSpec): string {
  const { labels, series, yMin, yMax } = spec;
  const x = (i: number) =>
    PAD + (labels.length === 1 ? 0 : (i / (labels.length - 1)) * (W - 2 * PAD));
  const y = (v: number) => H - PAD - ((v - yMin) / (yMax - yMin)) * (H - 2 * PAD);

  const polylines = series.map((s) =>
    `<polyline fill="none" stroke="${s.color}" stroke-width="2"
       points="${s.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}"/>`).join('');
  const legend = series.map((s, i) =>
    `<rect x="${PAD + i * 160}" y="8" width="12" height="12" fill="${s.color}"/>
     <text x="${PAD + i * 160 + 16}" y="18" font-size="12">${esc(s.name)}</text>`).join('');
  const xLabels = labels.map((l, i) =>
    i % Math.ceil(labels.length / 12) === 0
      ? `<text x="${x(i)}" y="${H - PAD + 16}" font-size="10" text-anchor="middle">${esc(l)}</text>`
      : '').join('');
  const gridLines = [yMin, (yMin + yMax) / 2, yMax].map((v) =>
    `<line x1="${PAD}" y1="${y(v)}" x2="${W - PAD}" y2="${y(v)}" stroke="#ddd"/>
     <text x="${PAD - 6}" y="${y(v) + 4}" font-size="10" text-anchor="end">${v}</text>`).join('');

  return svgShell(spec.title, `${gridLines}${polylines}${legend}${xLabels}`);
}

export interface ScatterSpec {
  title: string;
  points: { label: string; x: number; y: number }[]; // both axes -100..100
}

export function scatterSvg(spec: ScatterSpec): string {
  const sx = (v: number) => PAD + ((v + 100) / 200) * (W - 2 * PAD);
  const sy = (v: number) => H - PAD - ((v + 100) / 200) * (H - 2 * PAD);
  const pts = spec.points.map((p) =>
    `<circle cx="${sx(p.x)}" cy="${sy(p.y)}" r="6" fill="#1d6fa5" opacity="0.8"/>
     <text x="${sx(p.x) + 8}" y="${sy(p.y) + 4}" font-size="11">${esc(p.label)}</text>`).join('');
  const diagonal =
    `<line x1="${sx(-100)}" y1="${sy(-100)}" x2="${sx(100)}" y2="${sy(100)}"
       stroke="#bbb" stroke-dasharray="4 4"/>`;
  const axes =
    `<text x="${W / 2}" y="${H - 8}" font-size="12" text-anchor="middle">Deeds score →</text>
     <text x="14" y="${H / 2}" font-size="12" text-anchor="middle"
       transform="rotate(-90 14 ${H / 2})">Self-presentation →</text>`;
  return svgShell(spec.title, `${diagonal}${pts}${axes}`);
}

function svgShell(title: string, inner: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"
    viewBox="0 0 ${W} ${H}" font-family="Georgia, serif" style="background:#fff">
    <text x="${W / 2}" y="${PAD - 18}" font-size="15" text-anchor="middle"
      font-weight="bold">${esc(title)}</text>
    <text x="${W - 8}" y="${H - 6}" font-size="9" text-anchor="end" fill="#888">
      EvilI methodology v${METHODOLOGY_VERSION}</text>
    ${inner}</svg>`;
}

export function renderReportCharts(slot: HTMLElement, r: AnalysisReport): void {
  if (!r.segments.length) return;
  const svg = lineChartSvg({
    title: `Narrative arc — ${r.title}`,
    labels: r.segments.map((s) => s.label.replace(/^(CHAPTER|LETTER|CHAP\.?)\s*/i, 'Ch ')),
    series: [
      { name: 'Reliability', color: '#1d6fa5', values: r.segments.map((s) => s.reliability) },
      { name: 'Deeds', color: '#b45309', values: r.segments.map((s) => s.deeds) },
      { name: 'Self-presentation', color: '#2e7d32', values: r.segments.map((s) => s.selfPresentation) },
    ],
    yMin: -100, yMax: 100,
  });
  slot.innerHTML = svg + chartExportButtons('arc');
  wireChartExport(slot, svg, `evili-arc-${slug(r.title)}`);
}

export function chartExportButtons(id: string): string {
  return `<div class="chart-export">
    <button data-export="svg" data-chart="${id}">Download SVG</button>
    <button data-export="png" data-chart="${id}">Download PNG</button></div>`;
}

export function wireChartExport(slot: HTMLElement, svg: string, filename: string): void {
  slot.querySelector('[data-export="svg"]')?.addEventListener('click', () =>
    download(`${filename}.svg`, new Blob([svg], { type: 'image/svg+xml' })));
  slot.querySelector('[data-export="png"]')?.addEventListener('click', () => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = W * 2; canvas.height = H * 2; // 2x for slides
      const ctx = canvas.getContext('2d')!;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((b) => b && download(`${filename}.png`, b));
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  });
}

export function download(name: string, blob: Blob): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
