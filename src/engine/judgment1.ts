import type { PerspectiveResult } from './types';
import { clamp } from './types';
import { maskDialogue } from './segment';

// These g-flagged regexes must only be used with String.prototype.match(),
// which resets lastIndex; .exec()/.test() on them would be stateful.
const FIRST = /\b(?:i|me|my|mine|myself|we|us|our|ours|ourselves)\b/gi;
const THIRD = /\b(?:he|him|his|she|her|hers|they|them|their|theirs)\b/gi;
const SECOND = /\b(?:you|your|yours|thou|thee|thy|thine)\b/gi;
const SELF_REF = /\bI (?:shall now relate|have (?:said|related|told)|must (?:tell|confess|own)|proceed to)\b/gi;

export function detectPerspective(text: string): PerspectiveResult {
  // maskDialogue strips only double-quoted speech; single-quoted or
  // dash-delimited dialogue must be normalized to double quotes upstream.
  const narration = maskDialogue(text);
  const words = (narration.match(/\b[\w']+\b/g) ?? []).length || 1;
  const per1k = (n: number) => (n / words) * 1000;

  const fp = (narration.match(FIRST) ?? []).length;
  const tp = (narration.match(THIRD) ?? []).length;
  const sp = (narration.match(SECOND) ?? []).length;
  const selfRef = (narration.match(SELF_REF) ?? []).length;

  const fpShare = fp / Math.max(fp + tp, 1);
  const secondPer1k = per1k(sp);

  let verdict: PerspectiveResult['verdict'];
  if (fpShare >= 0.45 && secondPer1k >= 12) verdict = 'mixed-epistolary';
  else if (fpShare >= 0.45) verdict = 'first-person';
  else if (fpShare <= 0.2) verdict = 'third-person';
  else verdict = 'mixed-epistolary';

  // confidence: distance from the decision boundary, boosted by self-reference
  const confidence = clamp(
    Math.abs(fpShare - 0.325) / 0.325 + Math.min(selfRef * 0.1, 0.3), 0, 1);

  return {
    verdict,
    confidence,
    firstPersonPer1k: per1k(fp),
    thirdPersonPer1k: per1k(tp),
  };
}
