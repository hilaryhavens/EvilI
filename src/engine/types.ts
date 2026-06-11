export const METHODOLOGY_VERSION = '0.1.0';

export type Signal =
  | 'hedging' | 'justification' | 'retraction' | 'contradiction'
  | 'viceDeed' | 'virtueDeed' | 'selfVice' | 'selfVirtue';

export interface EvidenceHit {
  signal: Signal;
  term: string;          // lexicon term or phrase that matched
  sentence: string;
  charStart: number;     // offsets into the processed text
  charEnd: number;
  segmentIndex: number;
  weight: number;        // lexicon weight (always positive)
}

export interface PerspectiveResult {
  verdict: 'first-person' | 'third-person' | 'mixed-epistolary';
  confidence: number;          // 0..1
  firstPersonPer1k: number;    // densities in narration only
  thirdPersonPer1k: number;
}

export interface MoralityResult {
  deeds: number;               // -100..100
  selfPresentation: number;    // -100..100
  deedsBand: string;
  selfPresentationBand: string;
}

export interface ReliabilityResult {
  index: number;               // 0..100, 100 = maximally reliable
  signals: { s1: number; s2: number; s3: number; s4: number };
  // s1/s2/s4 = weighted hits per 1000 recognized words; s3 = gap score 0..100
}

export interface OcrCorrection { original: string; corrected: string; offset: number }

export interface OcrReport {
  corrections: OcrCorrection[];
  unknownTokenRate: number;    // 0..1, after correction
  recognizedWordCount: number;
}

export interface SegmentScores {
  segmentIndex: number;
  label: string;               // e.g. "Chapter 3" or "Segment 3"
  reliability: number;
  deeds: number;
  selfPresentation: number;
}

export interface AnalysisReport {
  title: string;
  methodologyVersion: string;
  wordCount: number;
  processedText: string;       // what evidence offsets refer to
  ocr: OcrReport;
  perspective: PerspectiveResult;
  reliability: ReliabilityResult | null;   // null when not first-person
  morality: MoralityResult | null;
  segments: SegmentScores[];
  evidence: EvidenceHit[];
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function moralBand(score: number): string {
  if (score >= 60) return 'virtuous';
  if (score >= 20) return 'mostly virtuous';
  if (score > -20) return 'ambiguous';
  if (score > -60) return 'questionable';
  return 'immoral';
}
