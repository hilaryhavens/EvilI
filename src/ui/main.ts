// src/ui/main.ts
import './styles.css';
import { renderInputView, type TextInput } from './inputView';
import { analyzeInWorker } from '../engine/workerClient';
import type { AnalysisReport } from '../engine/types';

const app = document.querySelector<HTMLDivElement>('#app')!;

function showInput() {
  renderInputView(app, runAnalysis);
}

async function runAnalysis(texts: TextInput[]) {
  app.innerHTML = `<p class="working">Analyzing ${texts.length} text(s)&hellip;
    long novels can take a minute.</p>`;
  const reports: AnalysisReport[] = [];
  for (const t of texts) reports.push(await analyzeInWorker(t.text, t.title));
  const { showResults } = await import('./resultsView');
  showResults(app, reports, showInput);
}

showInput();
