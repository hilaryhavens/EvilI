import type { Dictionary } from './dictionary';
import type { OcrReport, OcrCorrection } from './types';

// OCR character confusions common in ECCO-scanned 18th-century texts.
// Entries with digits removed: the token regex only captures [A-Za-z] letters,
// so /1/→'l' and /0/→'o' would never match and are dead code.
const CONFUSIONS: [RegExp, string][] = [
  [/f/g, 's'],   // long-s misread (the dominant error in ECCO texts)
  [/rn/g, 'm'],
  [/m/g, 'rn'],
  [/c/g, 'e'],
  [/e/g, 'c'],
  [/h/g, 'b'],
  [/li/g, 'h'],
];

export function remediateOcr(
  raw: string,
  dict: Dictionary,
): { text: string; report: OcrReport } {
  // 1. Rejoin hyphenated line-break splits: word-\nword → wordword
  let text = raw.replace(/([A-Za-z])-\r?\n\s*([a-z])/g, '$1$2');

  const corrections: OcrCorrection[] = [];
  let total = 0;
  let unknown = 0;
  let recognized = 0;

  text = text.replace(/[A-Za-z](?:[A-Za-z'']*[A-Za-z])?/g, (w, offset: number) => {
    total++;
    // Core invariant: known words are never touched.
    if (dict.isKnown(w)) { recognized++; return w; }
    const fixed = repair(w, dict);
    if (fixed) {
      corrections.push({ original: w, corrected: fixed, offset });
      recognized++;
      return fixed;
    }
    unknown++;
    return w;
  });

  return {
    text,
    report: {
      corrections,
      unknownTokenRate: total === 0 ? 0 : unknown / total,
      recognizedWordCount: recognized,
    },
  };
}

function repair(w: string, dict: Dictionary): string | null {
  const lower = w.toLowerCase();

  for (const [re, sub] of CONFUSIONS) {
    // Try replacing ALL occurrences of this confusion at once.
    const all = lower.replace(re, sub);
    if (all !== lower && dict.isKnown(all)) return matchCase(w, all);

    // Try replacing each individual occurrence.
    const single = new RegExp(re.source, 'g');
    let m: RegExpExecArray | null;
    while ((m = single.exec(lower)) !== null) {
      const cand = lower.slice(0, m.index) + sub + lower.slice(m.index + m[0].length);
      if (dict.isKnown(cand)) return matchCase(w, cand);
    }
  }

  // Run-together split: try every split yielding two known words.
  // Minimum fragment length 3 to avoid spurious single-letter splits.
  for (let i = 3; i <= lower.length - 3; i++) {
    const a = lower.slice(0, i), b = lower.slice(i);
    if (dict.isKnown(a) && dict.isKnown(b)) return matchCase(w, `${a} ${b}`);
  }

  return null;
}

function matchCase(original: string, replacement: string): string {
  if (original[0] === original[0].toUpperCase() && original[0] !== original[0].toLowerCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}
