// src/ui/resultsView.ts
import type { AnalysisReport, EvidenceHit, Signal } from '../engine/types';

const SIGNAL_LABELS: Record<Signal, string> = {
  hedging: 'Hedging', justification: 'Self-justification', retraction: 'Retraction',
  contradiction: 'Contradiction', viceDeed: 'Vice (deed)', virtueDeed: 'Virtue (deed)',
  selfVice: 'Self-presentation (vice)', selfVirtue: 'Self-presentation (virtue)',
};
const SIGNAL_CLASSES: Record<Signal, string> = {
  hedging: 'sig-hedging', justification: 'sig-justification', retraction: 'sig-retraction',
  contradiction: 'sig-contradiction', viceDeed: 'sig-vice', virtueDeed: 'sig-virtue',
  selfVice: 'sig-self', selfVirtue: 'sig-self',
};
const ESTIMATE_NOTE = 'computational estimate from lexical evidence — see methodology';

export function showResults(
  root: HTMLElement,
  reports: AnalysisReport[],
  onBack: () => void,
): void {
  root.innerHTML = '';
  const back = document.createElement('button');
  back.textContent = '← New analysis';
  back.addEventListener('click', onBack);
  root.appendChild(back);

  if (reports.length > 1) {
    const slot = document.createElement('div');
    slot.id = 'comparison-slot';
    root.appendChild(slot);
    import('./comparisonView').then(({ renderComparison }) =>
      renderComparison(slot, reports, (r) => selectReport(root, r)),
    ).catch(() => {});

    const tabs = document.createElement('div');
    tabs.className = 'report-tabs';
    for (const r of reports) {
      const tab = document.createElement('button');
      tab.textContent = r.title;
      tab.dataset.title = r.title;
      tab.addEventListener('click', () => selectReport(root, r));
      tabs.appendChild(tab);
    }
    root.appendChild(tabs);
  }
  selectReport(root, reports[0]);
}

function selectReport(root: HTMLElement, r: AnalysisReport): void {
  root.querySelectorAll<HTMLElement>('.report-tabs button').forEach((b) =>
    b.classList.toggle('active', b.dataset.title === r.title));
  renderSingle(root, r);
}

export function renderSingle(root: HTMLElement, r: AnalysisReport): void {
  let container = root.querySelector<HTMLElement>('#single-result');
  if (!container) {
    container = document.createElement('div');
    container.id = 'single-result';
    root.appendChild(container);
  }
  const fp = r.perspective.verdict !== 'third-person';
  container.innerHTML = `
    <h2>${escapeHtml(r.title)}</h2>
    ${r.ocr.unknownTokenRate > 0.05 ? `
      <div class="ocr-banner">⚠ This text contains significant OCR noise
        (${(r.ocr.unknownTokenRate * 100).toFixed(1)}% unrecognized tokens after
        ${r.ocr.corrections.length} automatic corrections); scores may be less precise.</div>` : ''}
    <div class="verdict-cards">
      <div class="verdict-card">
        <h3>Perspective</h3>
        <p class="big">${r.perspective.verdict}</p>
        <p>confidence ${(r.perspective.confidence * 100).toFixed(0)}%</p>
        <details><summary>details</summary>
          1st-person pronouns: ${r.perspective.firstPersonPer1k.toFixed(1)}/1000 words (narration only)<br>
          3rd-person pronouns: ${r.perspective.thirdPersonPer1k.toFixed(1)}/1000 words
        </details>
      </div>
      <div class="verdict-card ${fp ? '' : 'disabled'}">
        <h3>Reliability</h3>
        ${fp && r.reliability ? `
          <p class="big">${r.reliability.index.toFixed(0)} / 100</p>
          <p>${reliabilityLabel(r.reliability.index)}</p>
          <details><summary>signal densities</summary>
            S1 hedging (w1): ${r.reliability.signals.s1.toFixed(2)}/1k ·
            S2 justification (w2): ${r.reliability.signals.s2.toFixed(2)}/1k ·
            S3 deed/word gap (w2): ${r.reliability.signals.s3.toFixed(0)} ·
            S4 contradiction (w2): ${r.reliability.signals.s4.toFixed(2)}/1k
          </details>` : '<p>not computed — narrator analysis requires first-person narration</p>'}
      </div>
      <div class="verdict-card ${fp ? '' : 'disabled'}">
        <h3>Morality</h3>
        ${fp && r.morality ? `
          <p class="big">Deeds: ${r.morality.deeds.toFixed(0)} (${r.morality.deedsBand})</p>
          <p class="big">Self-presentation: ${r.morality.selfPresentation.toFixed(0)}
            (${r.morality.selfPresentationBand})</p>
          <p>scale: −100 immoral &harr; +100 virtuous</p>` : '<p>not computed</p>'}
      </div>
    </div>
    <p class="estimate-note">${ESTIMATE_NOTE}</p>
    <div id="charts-slot"></div>
    <div id="export-slot"></div>
    ${fp ? renderEvidenceExplorer(r) : ''}`;

  wireEvidenceFilters(container);
  import('./charts').then(({ renderReportCharts }) =>
    renderReportCharts(container!.querySelector('#charts-slot')!, r),
  ).catch(() => {});
  import('./export').then(({ renderExportButtons }) =>
    renderExportButtons(container!.querySelector('#export-slot')!, [r]),
  ).catch(() => {});
}

function renderEvidenceExplorer(r: AnalysisReport): string {
  const filters = Object.entries(SIGNAL_LABELS).map(([sig, label]) =>
    `<label class="${SIGNAL_CLASSES[sig as Signal]}">
       <input type="checkbox" data-signal="${sig}" checked> ${label}</label>`).join(' ');
  const sidebar = r.evidence.map((h, i) =>
    `<li class="${SIGNAL_CLASSES[h.signal]}" data-target="ev-${i}">
       <strong>${SIGNAL_LABELS[h.signal]}</strong> ("${escapeHtml(h.term)}", w${h.weight}):
       ${escapeHtml(truncate(h.sentence, 120))}</li>`).join('');
  return `
    <h3>Evidence explorer — ${r.evidence.length} hits</h3>
    <div class="filter-bar">${filters}</div>
    <div class="explorer">
      <div class="text-pane">${highlight(r.processedText, r.evidence)}</div>
      <ol class="hit-list">${sidebar}</ol>
    </div>`;
}

function highlight(text: string, hits: EvidenceHit[]): string {
  // non-overlapping, sorted by charStart (engine guarantees sort)
  let out = '', cursor = 0;
  hits.forEach((h, i) => {
    if (h.charStart < cursor) return; // skip overlaps
    out += escapeHtml(text.slice(cursor, h.charStart));
    out += `<mark id="ev-${i}" class="evidence ${SIGNAL_CLASSES[h.signal]}"
      title="${SIGNAL_LABELS[h.signal]}: ${escapeHtml(h.term)}">` +
      escapeHtml(text.slice(h.charStart, h.charEnd)) + '</mark>';
    cursor = h.charEnd;
  });
  out += escapeHtml(text.slice(cursor));
  return out.replace(/\n/g, '<br>');
}

function wireEvidenceFilters(container: HTMLElement): void {
  container.querySelectorAll<HTMLInputElement>('.filter-bar input').forEach((cb) => {
    cb.addEventListener('change', () => {
      const sig = cb.dataset.signal!;
      const cls = SIGNAL_CLASSES[sig as Signal];
      container.querySelectorAll(`.text-pane mark.${cls}, .hit-list li.${cls}`)
        .forEach((el) => el.classList.toggle('filtered', !cb.checked));
    });
  });
  container.querySelectorAll<HTMLElement>('.hit-list li').forEach((li) => {
    li.addEventListener('click', () => {
      document.getElementById(li.dataset.target!)?.scrollIntoView({ block: 'center' });
    });
  });
}

function reliabilityLabel(index: number): string {
  if (index >= 80) return 'substantially reliable';
  if (index >= 60) return 'broadly reliable';
  if (index >= 40) return 'questionable';
  if (index >= 20) return 'substantially unreliable';
  return 'profoundly unreliable';
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
