// src/ui/resultsView.ts — temporary stub, replaced in Task 16
import type { AnalysisReport } from '../engine/types';

export function showResults(root: HTMLElement, reports: AnalysisReport[], _onBack: () => void): void {
  root.textContent = JSON.stringify(reports[0].perspective);
}
