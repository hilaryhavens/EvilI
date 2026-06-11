// src/engine/engine.ts
import { createDictionary } from './dictionary';
import { normalizeTypography, normalizeSpelling } from './normalize';
import { remediateOcr } from './ocr';
import { stripTei } from './tei';
import { segmentText } from './segment';
import { detectPerspective } from './judgment1';
import { extractEvidence } from './attribution';
import { scoreMorality } from './judgment3';
import { scoreReliability } from './judgment2';
import { loadLexicons } from './lexicons';
import {
  METHODOLOGY_VERSION,
  type AnalysisReport, type SegmentScores,
} from './types';

export function analyze(rawInput: string, title: string): AnalysisReport {
  const dict = createDictionary();

  // pipeline: TEI strip -> typography -> OCR remediation -> spelling
  const plain = stripTei(rawInput);
  const typographic = normalizeTypography(plain);
  const { text: repaired, report: ocr } = remediateOcr(typographic, dict);
  const processedText = normalizeSpelling(repaired, dict);

  const wordCount = (processedText.match(/\b[\w']+\b/g) ?? []).length;
  const segments = segmentText(processedText);
  const segmentIndexAt = (offset: number) => {
    for (let i = segments.length - 1; i >= 0; i--) {
      if (offset >= segments[i].charStart) return i;
    }
    return 0;
  };

  const perspective = detectPerspective(processedText);

  const base = {
    title, methodologyVersion: METHODOLOGY_VERSION,
    wordCount, processedText, ocr, perspective,
  };

  if (perspective.verdict === 'third-person') {
    return { ...base, reliability: null, morality: null, segments: [], evidence: [] };
  }

  const lexicons = loadLexicons();
  const evidence = extractEvidence(processedText, lexicons, segmentIndexAt);
  const morality = scoreMorality(evidence);
  const reliability = scoreReliability(evidence, ocr.recognizedWordCount, morality);

  const segmentScores: SegmentScores[] = segments.map((seg, i) => {
    const segHits = evidence.filter((h) => h.segmentIndex === i);
    const segWords = (seg.text.match(/\b[\w']+\b/g) ?? []).length;
    const segMorality = scoreMorality(segHits);
    const segReliability = scoreReliability(segHits, segWords, segMorality);
    return {
      segmentIndex: i, label: seg.label,
      reliability: segReliability.index,
      deeds: segMorality.deeds,
      selfPresentation: segMorality.selfPresentation,
    };
  });

  return { ...base, reliability, morality, segments: segmentScores, evidence };
}
