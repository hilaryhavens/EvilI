// src/ui/export.ts
import type { AnalysisReport } from '../engine/types';
import { download } from './charts';

export function reportToJson(r: AnalysisReport): string {
  const { processedText: _omit, ...rest } = r;
  return JSON.stringify(rest, null, 2);
}

export function reportsToCsv(reports: AnalysisReport[]): string {
  const header = ['title', 'methodology_version', 'perspective', 'confidence',
    'reliability', 's1_hedging', 's2_justification', 's3_gap', 's4_contradiction',
    'deeds', 'deeds_band', 'self_presentation', 'self_presentation_band',
    'word_count', 'ocr_unknown_rate'].join(',');
  const rows = reports.map((r) => [
    q(r.title), q(r.methodologyVersion), q(r.perspective.verdict),
    r.perspective.confidence.toFixed(3),
    r.reliability?.index.toFixed(1) ?? '',
    r.reliability?.signals.s1.toFixed(3) ?? '', r.reliability?.signals.s2.toFixed(3) ?? '',
    r.reliability?.signals.s3.toFixed(1) ?? '', r.reliability?.signals.s4.toFixed(3) ?? '',
    r.morality?.deeds.toFixed(1) ?? '', q(r.morality?.deedsBand ?? ''),
    r.morality?.selfPresentation.toFixed(1) ?? '', q(r.morality?.selfPresentationBand ?? ''),
    r.wordCount, r.ocr.unknownTokenRate.toFixed(4),
  ].join(','));
  return [header, ...rows].join('\n');
}

export function hitsToCsv(r: AnalysisReport): string {
  const header = 'title,signal,term,weight,segment,char_start,char_end,sentence';
  const rows = r.evidence.map((h) =>
    [q(r.title), h.signal, q(h.term), h.weight, h.segmentIndex,
     h.charStart, h.charEnd, q(h.sentence)].join(','));
  return [header, ...rows].join('\n');
}

function q(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

export function renderExportButtons(slot: HTMLElement, reports: AnalysisReport[]): void {
  slot.innerHTML = `<div class="data-export">
    <button id="exp-json">Download JSON</button>
    <button id="exp-csv">Download CSV (metrics)</button>
    <button id="exp-hits">Download CSV (evidence hits)</button></div>`;
  slot.querySelector('#exp-json')!.addEventListener('click', () =>
    download('evili-report.json',
      new Blob([reports.length === 1 ? reportToJson(reports[0])
        : '[' + reports.map(reportToJson).join(',') + ']'],
        { type: 'application/json' })));
  slot.querySelector('#exp-csv')!.addEventListener('click', () =>
    download('evili-metrics.csv', new Blob([reportsToCsv(reports)], { type: 'text/csv' })));
  slot.querySelector('#exp-hits')!.addEventListener('click', () =>
    download('evili-evidence.csv',
      new Blob([reports.map(hitsToCsv).join('\n')], { type: 'text/csv' })));
}
