# EvilI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static GitHub Pages site that analyzes long-eighteenth-century British texts in the browser and reports first-person perspective, narrator reliability (0–100), and narrator morality (deeds vs. self-presentation, −100..+100), with evidence highlighting, charts, comparison, and export.

**Architecture:** Pure-TypeScript analysis engine (no UI deps) running in a Web Worker; wink-nlp for sentence/POS work; lexicons as JSON data files; vanilla-TS DOM UI; hand-rolled SVG charts (satisfies the spec's SVG+PNG export requirement more directly than Chart.js, which is canvas-only — flag this deviation to the user at execution start); Vite build; Vitest tests; GitHub Actions deploy.

**Tech Stack:** Vite, TypeScript, wink-nlp + wink-eng-lite-web-model, an-array-of-english-words (dictionary), Vitest (+ happy-dom for UI smoke tests).

**Spec:** `docs/superpowers/specs/2026-06-11-evili-design.md` — read it before starting.

**Conventions for all tasks:**
- Run tests with `npx vitest run <file>` (or no file for all). Build check: `npx tsc --noEmit`.
- Evidence offsets refer to the **processed text** (after OCR remediation + normalization); the evidence explorer displays that processed text. Document this in the methodology page (Task 21).
- Processing order inside the engine: `normalizeTypography` (certain char maps) → `remediateOcr` (dictionary-gated repairs) → `normalizeSpelling` (variant table, elided preterites). This satisfies the spec's "OCR remediation before normalization" for the dictionary-gated steps; typography char maps must precede OCR repair because ECCO text may contain literal `ſ`.
- Commit after every task (steps include the commands). Messages: `feat:`/`test:`/`chore:` prefixes.

---

## File structure

```
package.json, vite.config.ts, tsconfig.json, index.html
.github/workflows/deploy.yml
src/engine/types.ts          # report & evidence types, score bands
src/engine/dictionary.ts     # known-word set (English list + period variants)
src/engine/normalize.ts      # typography + spelling normalization
src/engine/ocr.ts            # OCR remediation + quality report
src/engine/tei.ts            # TEI/XML stripping
src/engine/segment.ts        # chapter segmentation + dialogue masking
src/engine/nlp.ts            # wink-nlp singleton wrapper
src/engine/lexicons.ts       # lexicon types + loader
src/engine/attribution.ts    # sentence scan -> EvidenceHit[] (all signals)
src/engine/judgment1.ts      # perspective
src/engine/judgment2.ts      # reliability
src/engine/judgment3.ts      # morality
src/engine/engine.ts         # analyze() orchestrator (pure function)
src/engine/worker.ts         # Web Worker entry
src/engine/workerClient.ts   # promise-based client for the UI
src/lexicons/*.json          # vice, virtue, selfPresentation, hedging,
                             # justification, retraction, variants
src/ui/main.ts               # app shell + routing between views
src/ui/inputView.ts          # paste / upload / corpus shelf
src/ui/resultsView.ts        # verdict cards, evidence explorer, OCR banner
src/ui/charts.ts             # SVG line chart, scatter, gauge + PNG/SVG export
src/ui/comparisonView.ts     # multi-text table + scatter
src/ui/export.ts             # JSON/CSV serialization + download helpers
src/ui/styles.css
public/corpus/               # fetched Gutenberg texts + corpus.json manifest
scripts/fetch-corpus.mjs     # downloads sample corpus (run once, committed)
methodology.html             # methodology page (renders lexicons at runtime)
tests/engine/*.test.ts       # unit tests per engine module
tests/validation.test.ts     # directional literary ground-truth suite
README.md, CITATION.cff
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/ui/main.ts`, `src/ui/styles.css`, `.gitignore`

- [ ] **Step 1: Scaffold**

```powershell
npm create vite@latest . -- --template vanilla-ts
npm install
npm install wink-nlp wink-eng-lite-web-model an-array-of-english-words
npm install -D vitest happy-dom
```

If `npm create vite` refuses a non-empty directory, scaffold into `tmp-scaffold` and move the generated files up (don't overwrite `docs/` or `BRAINSTORMING-NOTES.txt`).

- [ ] **Step 2: Configure**

`vite.config.ts`:
```ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/EvilI/', // repo name — adjust if the GitHub repo is named differently
  build: { target: 'es2022' },
  test: { environment: 'happy-dom' },
});
```

Add to `package.json` scripts: `"test": "vitest run"`. Delete Vite demo files (`src/counter.ts`, `src/typescript.svg`, demo content in `main.ts`). Replace `src/main.ts` with `src/ui/main.ts` containing for now:

```ts
import './styles.css';
document.querySelector<HTMLDivElement>('#app')!.textContent = 'EvilI';
```

Update `index.html` script tag to `/src/ui/main.ts` and title to `EvilI — Narrator Analysis`. Empty `src/ui/styles.css` for now. Ensure `.gitignore` has `node_modules/`, `dist/`.

- [ ] **Step 3: Verify build and empty test run**

Run: `npx tsc --noEmit && npm run build`
Expected: builds with no errors.

- [ ] **Step 4: Commit**

```powershell
git add -A && git commit -m "chore: scaffold Vite + TypeScript + Vitest project"
```

---

### Task 2: Engine types and score bands

**Files:**
- Create: `src/engine/types.ts`
- Test: `tests/engine/types.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/types.test.ts
import { describe, it, expect } from 'vitest';
import { moralBand, clamp } from '../../src/engine/types';

describe('moralBand', () => {
  it('maps scores to the five labeled bands', () => {
    expect(moralBand(80)).toBe('virtuous');
    expect(moralBand(40)).toBe('mostly virtuous');
    expect(moralBand(0)).toBe('ambiguous');
    expect(moralBand(-40)).toBe('questionable');
    expect(moralBand(-80)).toBe('immoral');
  });
});

describe('clamp', () => {
  it('clamps to range', () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(42, 0, 100)).toBe(42);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/engine/types.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/engine/types.ts
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
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/engine/types.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: engine report types and score bands"`

---

### Task 3: Dictionary

**Files:**
- Create: `src/engine/dictionary.ts`, `src/lexicons/variants.json`
- Test: `tests/engine/dictionary.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/dictionary.test.ts
import { describe, it, expect } from 'vitest';
import { createDictionary } from '../../src/engine/dictionary';

describe('dictionary', () => {
  const dict = createDictionary();
  it('knows ordinary English words', () => {
    expect(dict.isKnown('desire')).toBe(true);
    expect(dict.isKnown('she')).toBe(true);
  });
  it('knows period variant spellings so they are never "corrected"', () => {
    expect(dict.isKnown('chuse')).toBe(true);
    expect(dict.isKnown('shew')).toBe(true);
    expect(dict.isKnown('surprize')).toBe(true);
  });
  it('does not know OCR garbage', () => {
    expect(dict.isKnown('fhe')).toBe(false);
    expect(dict.isKnown('paffion')).toBe(false);
  });
  it('is case-insensitive', () => {
    expect(dict.isKnown('Desire')).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify failure** — `npx vitest run tests/engine/dictionary.test.ts` → FAIL.

- [ ] **Step 3: Implement**

`src/lexicons/variants.json` (extensible; keys = period spelling, values = modern):
```json
{
  "chuse": "choose", "chusing": "choosing", "shew": "show", "shewed": "showed",
  "shewn": "shown", "compleat": "complete", "compleated": "completed",
  "surprize": "surprise", "surprized": "surprised", "stile": "style",
  "intire": "entire", "intirely": "entirely", "antient": "ancient",
  "publick": "public", "musick": "music", "physick": "physic",
  "oeconomy": "economy", "connexion": "connection", "expence": "expense",
  "falshood": "falsehood", "cloathing": "clothing", "cloaths": "clothes",
  "befal": "befall", "untill": "until", "vertue": "virtue",
  "vertuous": "virtuous", "soure": "sour", "doat": "dote", "smoak": "smoke",
  "extream": "extreme", "extreamly": "extremely", "ballance": "balance",
  "terrour": "terror", "horrour": "horror", "authour": "author"
}
```

```ts
// src/engine/dictionary.ts
import words from 'an-array-of-english-words';
import variants from '../lexicons/variants.json';

export interface Dictionary {
  isKnown(word: string): boolean;
  variantOf(word: string): string | undefined; // modern form if word is a period variant
}

let cached: Dictionary | null = null;

export function createDictionary(): Dictionary {
  if (cached) return cached;
  const known = new Set<string>(words);
  const variantMap = new Map<string, string>(
    Object.entries(variants as Record<string, string>),
  );
  // archaic forms the word list may lack but our texts use constantly
  for (const w of ['methinks', 'hath', 'doth', 'thou', 'thee', 'thy', 'thine',
    'wert', 'art', 'ere', 'nay', 'betwixt', 'whilst', 'spake']) known.add(w);
  for (const v of variantMap.keys()) known.add(v);
  cached = {
    isKnown: (w) => known.has(w.toLowerCase()),
    variantOf: (w) => variantMap.get(w.toLowerCase()),
  };
  return cached;
}
```

Enable JSON imports in `tsconfig.json` compilerOptions: `"resolveJsonModule": true`.

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/engine/dictionary.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: dictionary with period variant spellings"`

---

### Task 4: Normalization

**Files:**
- Create: `src/engine/normalize.ts`
- Test: `tests/engine/normalize.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/normalize.test.ts
import { describe, it, expect } from 'vitest';
import { normalizeTypography, normalizeSpelling } from '../../src/engine/normalize';
import { createDictionary } from '../../src/engine/dictionary';

const dict = createDictionary();

describe('normalizeTypography', () => {
  it('converts long s and ligatures', () => {
    expect(normalizeTypography('paſſion and aﬄiction, ﬁre')).toBe('passion and affliction, fire');
  });
  it('expands &c.', () => {
    expect(normalizeTypography('books, papers, &c.')).toBe('books, papers, etc.');
  });
});

describe('normalizeSpelling', () => {
  it('maps period variants to modern forms', () => {
    expect(normalizeSpelling('I shall chuse to shew it', dict)).toBe('I shall choose to show it');
  });
  it('expands elided preterites when the result is a known word', () => {
    expect(normalizeSpelling("I walk'd and was deceiv'd", dict)).toBe('I walked and was deceived');
  });
  it('handles y-stem preterites', () => {
    expect(normalizeSpelling("she cry'd aloud", dict)).toBe('she cried aloud');
  });
  it('repairs u/v and i/j interchange for unknown words only', () => {
    expect(normalizeSpelling('vpon my ioy', dict)).toBe('upon my joy');
    expect(normalizeSpelling('have over', dict)).toBe('have over'); // known words untouched
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
// src/engine/normalize.ts
import type { Dictionary } from './dictionary';

export function normalizeTypography(text: string): string {
  return text
    .replace(/ſ/g, 's')
    .replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬀ/g, 'ff')
    .replace(/ﬃ/g, 'ffi').replace(/ﬄ/g, 'ffl').replace(/ﬆ/g, 'st')
    .replace(/&c\./g, 'etc.')
    .replace(/[‘’]/g, "'").replace(/[“”]/g, '"');
}

const WORD_RE = /[A-Za-z]+(?:'[A-Za-z]+)?/g;

export function normalizeSpelling(text: string, dict: Dictionary): string {
  return text.replace(WORD_RE, (w) => {
    const variant = dict.variantOf(w);
    if (variant) return matchCase(w, variant);
    const m = /^([A-Za-z]+)'d$/.exec(w);
    if (m) {
      const stem = m[1];
      for (const cand of [stem + 'ed', stem.replace(/y$/, 'i') + 'ed']) {
        if (dict.isKnown(cand)) return matchCase(w, cand);
      }
      return w;
    }
    if (!dict.isKnown(w)) {
      for (const cand of uvijCandidates(w)) {
        if (dict.isKnown(cand)) return matchCase(w, cand);
      }
    }
    return w;
  });
}

function uvijCandidates(w: string): string[] {
  const lower = w.toLowerCase();
  return [
    lower.replace(/^v/, 'u'),               // vpon -> upon
    lower.replace(/(?<=\w)u(?=\w)/g, 'v'),  // loue -> love
    lower.replace(/^i/, 'j'),               // ioy -> joy
    lower.replace(/^j/, 'i'),
  ];
}

function matchCase(original: string, replacement: string): string {
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}
```

- [ ] **Step 4: Run to verify pass** — PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: typography and period-spelling normalization"`

---

### Task 5: OCR remediation

**Files:**
- Create: `src/engine/ocr.ts`
- Test: `tests/engine/ocr.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/ocr.test.ts
import { describe, it, expect } from 'vitest';
import { remediateOcr } from '../../src/engine/ocr';
import { createDictionary } from '../../src/engine/dictionary';

const dict = createDictionary();

describe('remediateOcr', () => {
  it('repairs long-s-as-f misreads when the original is not a word', () => {
    const { text } = remediateOcr('fhe had fome fuch defire', dict);
    expect(text).toBe('she had some such desire');
  });
  it('leaves ambiguous real-word pairs alone', () => {
    const { text, report } = remediateOcr('his fame was the same', dict);
    expect(text).toBe('his fame was the same');
    expect(report.corrections).toHaveLength(0);
  });
  it('rejoins hyphenated line-break splits', () => {
    const { text } = remediateOcr('she con-\ntinued her story', dict);
    expect(text).toBe('she continued her story');
  });
  it('logs corrections with original and corrected forms', () => {
    const { report } = remediateOcr('fhe spoke', dict);
    expect(report.corrections[0]).toMatchObject({ original: 'fhe', corrected: 'she' });
  });
  it('computes unknown token rate and recognized word count', () => {
    const { report } = remediateOcr('she had qzxv strange words', dict);
    expect(report.recognizedWordCount).toBe(4);
    expect(report.unknownTokenRate).toBeCloseTo(1 / 5);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
// src/engine/ocr.ts
import type { Dictionary } from './dictionary';
import type { OcrReport, OcrCorrection } from './types';

const CONFUSIONS: [RegExp, string][] = [
  [/f/g, 's'],   // long-s misread (the big one)
  [/rn/g, 'm'],
  [/m/g, 'rn'],
  [/c/g, 'e'],
  [/e/g, 'c'],
  [/h/g, 'b'],
  [/li/g, 'h'],
  [/1/g, 'l'],
  [/0/g, 'o'],
];

export function remediateOcr(
  raw: string,
  dict: Dictionary,
): { text: string; report: OcrReport } {
  // 1. rejoin hyphenated line-break splits: word-\nword
  let text = raw.replace(/([A-Za-z])-\r?\n\s*([a-z])/g, '$1$2');

  const corrections: OcrCorrection[] = [];
  let total = 0;
  let unknown = 0;
  let recognized = 0;

  text = text.replace(/[A-Za-z](?:[A-Za-z'’]*[A-Za-z])?/g, (w, offset: number) => {
    total++;
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
  // single-substitution confusion candidates; fix only if it creates a known word
  for (const [re, sub] of CONFUSIONS) {
    // try replacing each occurrence individually, then all at once
    const all = lower.replace(re, sub);
    if (all !== lower && dict.isKnown(all)) return matchCase(w, all);
    let m: RegExpExecArray | null;
    const single = new RegExp(re.source, 'g');
    while ((m = single.exec(lower)) !== null) {
      const cand = lower.slice(0, m.index) + sub + lower.slice(m.index + m[0].length);
      if (dict.isKnown(cand)) return matchCase(w, cand);
    }
  }
  // run-together split: try every split point yielding two known words (len >= 2 each)
  for (let i = 2; i <= lower.length - 2; i++) {
    const a = lower.slice(0, i), b = lower.slice(i);
    if (dict.isKnown(a) && dict.isKnown(b)) return matchCase(w, `${a} ${b}`);
  }
  return null;
}

function matchCase(original: string, replacement: string): string {
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}
```

Note: `c→e` runs before `e→c` in the candidates list, and all repairs are gated on producing a known word from an unknown one — the don't-touch invariant is enforced structurally (`dict.isKnown(w)` early-returns before any repair attempt).

- [ ] **Step 4: Run to verify pass** — PASS. If the run-together splitter mangles a test case (e.g., splits a rare archaic word), raise the minimum fragment length to 3 and re-run.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: dictionary-gated OCR remediation with quality report"`

---

### Task 6: TEI/XML stripping

**Files:**
- Create: `src/engine/tei.ts`
- Test: `tests/engine/tei.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/tei.test.ts
import { describe, it, expect } from 'vitest';
import { stripTei } from '../../src/engine/tei';

describe('stripTei', () => {
  it('extracts text content from the <text> body, dropping the header', () => {
    const xml = `<TEI><teiHeader><title>Meta</title></teiHeader>
      <text><body><p>I was born in Newgate.</p><p>My mother was convicted.</p></body></text></TEI>`;
    expect(stripTei(xml)).toBe('I was born in Newgate.\n\nMy mother was convicted.');
  });
  it('decodes common entities', () => {
    const xml = `<text><p>Tom &amp; Moll &#8212; thieves</p></text>`;
    expect(stripTei(xml)).toContain('Tom & Moll');
  });
  it('passes plain text through unchanged', () => {
    expect(stripTei('Just plain prose.')).toBe('Just plain prose.');
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement** (regex-based so it runs in a Worker without DOM):

```ts
// src/engine/tei.ts
export function stripTei(input: string): string {
  if (!/^\s*</.test(input)) return input; // plain text
  let s = input;
  const bodyMatch = /<text[\s>][\s\S]*?<\/text>/i.exec(s);
  if (bodyMatch) s = bodyMatch[0];
  s = s.replace(/<teiHeader[\s\S]*?<\/teiHeader>/gi, '');
  s = s.replace(/<\/(p|div|lg|l|head)>/gi, '\n\n');   // block ends -> paragraph breaks
  s = s.replace(/<[^>]+>/g, '');
  s = s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
  return s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
```

- [ ] **Step 4: Run to verify pass** — PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: TEI/XML stripping for ECCO-TCP style inputs"`

---

### Task 7: Segmentation and dialogue masking

**Files:**
- Create: `src/engine/segment.ts`
- Test: `tests/engine/segment.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/segment.test.ts
import { describe, it, expect } from 'vitest';
import { segmentText, maskDialogue } from '../../src/engine/segment';

describe('segmentText', () => {
  it('splits on chapter and letter headings', () => {
    const text = 'CHAPTER I\nFirst part here.\nCHAPTER II\nSecond part here.';
    const segs = segmentText(text);
    expect(segs).toHaveLength(2);
    expect(segs[0].label).toBe('CHAPTER I');
    expect(segs[1].text).toContain('Second part');
    expect(segs[1].charStart).toBe(text.indexOf('CHAPTER II'));
  });
  it('falls back to ~2000-word segments when no headings exist', () => {
    const text = Array(4500).fill('word').join(' ');
    const segs = segmentText(text);
    expect(segs.length).toBe(3);
    expect(segs[0].label).toBe('Segment 1');
  });
});

describe('maskDialogue', () => {
  it('replaces quoted spans with spaces, preserving length and offsets', () => {
    const text = 'He said, "I am innocent," and left.';
    const masked = maskDialogue(text);
    expect(masked.length).toBe(text.length);
    expect(masked).not.toContain('innocent');
    expect(masked.slice(0, 8)).toBe('He said,');
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
// src/engine/segment.ts
export interface Segment { label: string; text: string; charStart: number }

const HEADING_RE = /^[ \t]*(?:CHAP(?:TER|\.)?|LETTER|PART|BOOK|VOL(?:UME|\.)?)[ \t]+[\w.]+.*$/gim;

export function segmentText(text: string): Segment[] {
  const headings: { index: number; label: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = HEADING_RE.exec(text)) !== null) {
    headings.push({ index: m.index, label: m[0].trim() });
  }
  if (headings.length >= 2) {
    return headings.map((h, i) => {
      const end = i + 1 < headings.length ? headings[i + 1].index : text.length;
      return { label: h.label, text: text.slice(h.index, end), charStart: h.index };
    });
  }
  // fallback: fixed-size ~2000-word segments
  const words = [...text.matchAll(/\S+/g)];
  if (words.length === 0) return [{ label: 'Segment 1', text, charStart: 0 }];
  const segs: Segment[] = [];
  for (let i = 0; i < words.length; i += 2000) {
    const start = words[i].index!;
    const endWord = words[Math.min(i + 2000, words.length) - 1];
    const end = endWord.index! + endWord[0].length;
    segs.push({
      label: `Segment ${segs.length + 1}`,
      text: text.slice(start, end),
      charStart: start,
    });
  }
  return segs;
}

export function maskDialogue(text: string): string {
  // mask double-quoted spans (incl. typographic quotes already normalized to ")
  return text.replace(/"[^"\n]{1,600}"/g, (q) => ' '.repeat(q.length));
}
```

- [ ] **Step 4: Run to verify pass** — PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: chapter segmentation and dialogue masking"`

---

### Task 8: NLP wrapper and Judgment 1 (perspective)

**Files:**
- Create: `src/engine/nlp.ts`, `src/engine/judgment1.ts`
- Test: `tests/engine/judgment1.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/judgment1.test.ts
import { describe, it, expect } from 'vitest';
import { detectPerspective } from '../../src/engine/judgment1';

const FP = `I was born in the year 1632. I had two elder brothers and my father
designed me for the law; but I would be satisfied with nothing but going to sea.
My mind was filled with rambling thoughts, and I resolved upon my voyage.`;

const TP = `She was born in the year 1632. She had two elder brothers and her father
designed her for the law; but she would be satisfied with nothing but the town.
Her mind was filled with rambling thoughts, and he resolved against her wishes.`;

describe('detectPerspective', () => {
  it('detects first-person narration', () => {
    const r = detectPerspective(FP);
    expect(r.verdict).toBe('first-person');
    expect(r.confidence).toBeGreaterThan(0.5);
  });
  it('detects third-person narration', () => {
    expect(detectPerspective(TP).verdict).toBe('third-person');
  });
  it('ignores first-person pronouns inside dialogue', () => {
    const tpWithDialogue = TP + ' "I am sure I shall never consent," said she. "I will not."';
    expect(detectPerspective(tpWithDialogue).verdict).toBe('third-person');
  });
  it('flags heavy second-person address as mixed-epistolary', () => {
    const epistolary = `Dear Madam, you will wonder that I write to you so soon.
    Thou knowest, dear friend, what thou hast asked of me, and you shall hear all.
    You must know that you are ever in my thoughts, as thou art in my prayers.`;
    expect(detectPerspective(epistolary).verdict).toBe('mixed-epistolary');
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
// src/engine/nlp.ts
import winkNLP, { type WinkMethods } from 'wink-nlp';
import model from 'wink-eng-lite-web-model';

let instance: WinkMethods | null = null;
export function getNlp(): WinkMethods {
  if (!instance) instance = winkNLP(model);
  return instance;
}
```

```ts
// src/engine/judgment1.ts
import type { PerspectiveResult } from './types';
import { clamp } from './types';
import { maskDialogue } from './segment';

const FIRST = /\b(?:i|me|my|mine|myself|we|us|our|ours|ourselves)\b/gi;
const THIRD = /\b(?:he|him|his|she|her|hers|they|them|their|theirs)\b/gi;
const SECOND = /\b(?:you|your|yours|thou|thee|thy|thine)\b/gi;
const SELF_REF = /\bI (?:shall now relate|have (?:said|related|told)|must (?:tell|confess|own)|proceed to)\b/gi;

export function detectPerspective(text: string): PerspectiveResult {
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
```

(`nlp.ts` is unused by Judgment 1 — regex suffices here — but is created now because Task 9's attribution needs it; keeping it in this task means every later import resolves.)

- [ ] **Step 4: Run to verify pass** — PASS. Thresholds (0.45/0.2, 12/1k) are tunable constants; if a test fails marginally, adjust the test text rather than weakening the threshold.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: perspective detection with dialogue exclusion (Judgment 1)"`

---

### Task 9: Lexicon data and loader

**Files:**
- Create: `src/lexicons/vice.json`, `src/lexicons/virtue.json`, `src/lexicons/selfPresentation.json`, `src/lexicons/hedging.json`, `src/lexicons/justification.json`, `src/lexicons/retraction.json`, `src/engine/lexicons.ts`
- Test: `tests/engine/lexicons.test.ts`

**Note:** these are seed lexicons (~20–30 entries each). The spec calls for 50–150 per category at launch; expansion is *editorial data curation by the project owner* (a period-literature specialist), not engineering work — the JSON format below is the deliverable that makes that curation possible. Flag remaining curation in the final report to the user.

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/lexicons.test.ts
import { describe, it, expect } from 'vitest';
import { loadLexicons } from '../../src/engine/lexicons';

describe('loadLexicons', () => {
  const lex = loadLexicons();
  it('loads all six categories', () => {
    for (const k of ['vice', 'virtue', 'selfPresentation', 'hedging', 'justification', 'retraction'] as const) {
      expect(lex[k].entries.length).toBeGreaterThan(10);
    }
  });
  it('every entry has term, forms, and positive weight', () => {
    for (const cat of Object.values(lex)) {
      for (const e of cat.entries) {
        expect(e.term.length).toBeGreaterThan(0);
        expect(e.forms.length).toBeGreaterThan(0);
        expect(e.weight).toBeGreaterThan(0);
      }
    }
  });
  it('builds a form lookup map', () => {
    expect(lex.vice.formIndex.get('stole')?.term).toBe('steal');
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Create lexicon files**

Entry shape: `term` (lemma), `forms` (surface forms matched, lowercase), `weight` (1–3; 3 = strongest evidence), optional `polarity` (selfPresentation only: 1 virtue, -1 vice), optional `kind` (`"word"` default, `"phrase"` for multi-word patterns matched against lowercased text).

`src/lexicons/vice.json` (deed verbs/nouns — first-person agency required at match time):
```json
{ "category": "vice", "entries": [
  { "term": "steal", "forms": ["steal", "stole", "stolen", "stealing", "steals"], "weight": 3 },
  { "term": "rob", "forms": ["rob", "robbed", "robbing", "robbery", "robberies"], "weight": 3 },
  { "term": "thieve", "forms": ["thief", "thieving", "theft", "thefts"], "weight": 3 },
  { "term": "murder", "forms": ["murder", "murdered", "murdering", "murderer"], "weight": 3 },
  { "term": "kill", "forms": ["kill", "killed", "killing", "slew", "slain"], "weight": 3 },
  { "term": "cheat", "forms": ["cheat", "cheated", "cheating", "cheats"], "weight": 2 },
  { "term": "defraud", "forms": ["defraud", "defrauded", "fraud"], "weight": 2 },
  { "term": "deceive", "forms": ["deceive", "deceived", "deceiving", "deceit", "deceitful"], "weight": 2 },
  { "term": "lie", "forms": ["lied", "lying", "falsehood", "falsehoods", "dissemble", "dissembled", "dissembling"], "weight": 2 },
  { "term": "seduce", "forms": ["seduce", "seduced", "seducing", "debauch", "debauched"], "weight": 2 },
  { "term": "whore", "forms": ["whore", "whoredom", "harlot", "lewdness", "fornication", "adultery"], "weight": 2 },
  { "term": "drunk", "forms": ["drunk", "drunkenness", "drunkard", "intoxicated"], "weight": 1 },
  { "term": "game", "forms": ["gaming", "gamester", "gambled", "gambling", "wager", "wagered"], "weight": 1 },
  { "term": "swear", "forms": ["swore", "cursed", "cursing", "blasphemy", "blasphemed"], "weight": 1 },
  { "term": "betray", "forms": ["betray", "betrayed", "betraying", "treachery"], "weight": 2 },
  { "term": "forge", "forms": ["forge", "forged", "forgery", "counterfeit", "counterfeited"], "weight": 2 },
  { "term": "bribe", "forms": ["bribe", "bribed", "bribery"], "weight": 2 },
  { "term": "avarice", "forms": ["avarice", "avaricious", "covetousness", "coveted"], "weight": 1 },
  { "term": "vanity", "forms": ["vanity", "vainglory"], "weight": 1 },
  { "term": "idle", "forms": ["idleness", "sloth", "slothful"], "weight": 1 },
  { "term": "ruin", "forms": ["ruined", "undone", "debauchery"], "weight": 1 },
  { "term": "plunder", "forms": ["plunder", "plundered", "pillage", "pillaged"], "weight": 3 },
  { "term": "abandon", "forms": ["abandoned", "forsook", "forsaken", "deserted"], "weight": 1 }
] }
```

`src/lexicons/virtue.json`:
```json
{ "category": "virtue", "entries": [
  { "term": "repent", "forms": ["repent", "repented", "repenting", "repentance", "penitence", "penitent"], "weight": 3 },
  { "term": "pray", "forms": ["prayed", "praying", "prayers", "devotion", "devotions"], "weight": 2 },
  { "term": "charity", "forms": ["charity", "charitable", "alms", "almsgiving"], "weight": 3 },
  { "term": "give", "forms": ["gave", "bestowed", "relieved", "succoured", "succored"], "weight": 1 },
  { "term": "forgive", "forms": ["forgive", "forgave", "forgiven", "forgiveness", "pardoned"], "weight": 2 },
  { "term": "honest", "forms": ["honest", "honesty", "honestly"], "weight": 2 },
  { "term": "labour", "forms": ["laboured", "labored", "industry", "industrious", "toiled", "diligence", "diligent"], "weight": 2 },
  { "term": "duty", "forms": ["duty", "dutiful", "obedience", "obedient", "obeyed"], "weight": 1 },
  { "term": "thank", "forms": ["thanked", "thankful", "gratitude", "grateful"], "weight": 1 },
  { "term": "confess", "forms": ["confessed", "confession", "acknowledged"], "weight": 2 },
  { "term": "amend", "forms": ["amend", "amended", "amendment", "reformed", "reformation"], "weight": 2 },
  { "term": "chaste", "forms": ["chastity", "chaste", "modesty", "modest"], "weight": 2 },
  { "term": "prudence", "forms": ["prudence", "prudent", "prudently"], "weight": 1 },
  { "term": "piety", "forms": ["piety", "pious", "piously", "godliness", "godly"], "weight": 2 },
  { "term": "mercy", "forms": ["mercy", "merciful", "compassion", "compassionate", "pity", "pitied"], "weight": 2 },
  { "term": "restore", "forms": ["restored", "restitution", "repaid", "repay"], "weight": 2 },
  { "term": "protect", "forms": ["protected", "defended", "rescued", "preserved"], "weight": 1 },
  { "term": "temperance", "forms": ["temperance", "temperate", "sober", "sobriety"], "weight": 1 },
  { "term": "humility", "forms": ["humility", "humble", "humbled", "meekness", "meek"], "weight": 1 },
  { "term": "faithful", "forms": ["faithful", "fidelity", "constancy", "constant"], "weight": 1 },
  { "term": "virtue", "forms": ["virtue", "virtuous", "virtuously"], "weight": 2 }
] }
```

`src/lexicons/selfPresentation.json` (self-descriptive moral register; polarity-signed):
```json
{ "category": "selfPresentation", "entries": [
  { "term": "honest self", "forms": ["honest", "honestly"], "weight": 2, "polarity": 1 },
  { "term": "innocent self", "forms": ["innocent", "innocence", "blameless", "guiltless"], "weight": 2, "polarity": 1 },
  { "term": "virtuous self", "forms": ["virtuous", "vertuous", "good", "worthy"], "weight": 1, "polarity": 1 },
  { "term": "pious self", "forms": ["pious", "godly", "devout", "religious"], "weight": 2, "polarity": 1 },
  { "term": "penitent self", "forms": ["penitent", "repentant", "contrite"], "weight": 2, "polarity": 1 },
  { "term": "modest self", "forms": ["modest", "chaste", "sober", "prudent"], "weight": 1, "polarity": 1 },
  { "term": "dutiful self", "forms": ["dutiful", "obedient", "faithful", "loyal"], "weight": 1, "polarity": 1 },
  { "term": "grateful self", "forms": ["grateful", "thankful"], "weight": 1, "polarity": 1 },
  { "term": "sincere self", "forms": ["sincere", "sincerity", "true", "upright"], "weight": 1, "polarity": 1 },
  { "term": "industrious self", "forms": ["industrious", "diligent"], "weight": 1, "polarity": 1 },
  { "term": "wicked self", "forms": ["wicked", "wickedness", "evil"], "weight": 2, "polarity": -1 },
  { "term": "sinful self", "forms": ["sinful", "sinner", "sins", "sin"], "weight": 2, "polarity": -1 },
  { "term": "wretch self", "forms": ["wretch", "wretched", "miserable"], "weight": 1, "polarity": -1 },
  { "term": "guilty self", "forms": ["guilty", "guilt", "criminal"], "weight": 2, "polarity": -1 },
  { "term": "vile self", "forms": ["vile", "base", "infamous", "abandoned"], "weight": 2, "polarity": -1 },
  { "term": "foolish self", "forms": ["foolish", "folly", "fool", "vain"], "weight": 1, "polarity": -1 },
  { "term": "hardened self", "forms": ["hardened", "obstinate", "impenitent"], "weight": 2, "polarity": -1 },
  { "term": "false self", "forms": ["false", "deceitful", "hypocrite", "hypocrisy"], "weight": 2, "polarity": -1 },
  { "term": "shameful self", "forms": ["shame", "ashamed", "shameful", "disgrace"], "weight": 1, "polarity": -1 },
  { "term": "cruel self", "forms": ["cruel", "cruelty", "hardhearted", "unkind"], "weight": 2, "polarity": -1 }
] }
```

`src/lexicons/hedging.json` (S1 — phrases matched in narration):
```json
{ "category": "hedging", "entries": [
  { "term": "perhaps", "forms": ["perhaps"], "weight": 1 },
  { "term": "methinks", "forms": ["methinks", "methought"], "weight": 1 },
  { "term": "i know not", "forms": ["i know not", "i knew not"], "weight": 2, "kind": "phrase" },
  { "term": "i cannot tell", "forms": ["i cannot tell", "i could not tell"], "weight": 2, "kind": "phrase" },
  { "term": "if i remember", "forms": ["if i remember", "if my memory", "as i remember"], "weight": 2, "kind": "phrase" },
  { "term": "i believe", "forms": ["i believe", "i believed"], "weight": 1, "kind": "phrase" },
  { "term": "i suppose", "forms": ["i suppose", "i supposed"], "weight": 1, "kind": "phrase" },
  { "term": "it may be", "forms": ["it may be", "it might be"], "weight": 1, "kind": "phrase" },
  { "term": "i think", "forms": ["i think", "i thought"], "weight": 1, "kind": "phrase" },
  { "term": "as far as i", "forms": ["as far as i can", "as far as i could", "as near as i can"], "weight": 2, "kind": "phrase" },
  { "term": "i cannot say", "forms": ["i cannot say", "i could not say"], "weight": 2, "kind": "phrase" },
  { "term": "seemed", "forms": ["seemed", "seemingly"], "weight": 1 },
  { "term": "i forget", "forms": ["i forget", "i have forgot", "i have forgotten"], "weight": 2, "kind": "phrase" },
  { "term": "some say", "forms": ["some say", "some said", "it was said"], "weight": 1, "kind": "phrase" },
  { "term": "doubtless", "forms": ["doubtless", "no doubt"], "weight": 1 },
  { "term": "uncertain", "forms": ["uncertain", "uncertainty"], "weight": 1 }
] }
```

`src/lexicons/justification.json` (S2):
```json
{ "category": "justification", "entries": [
  { "term": "driven by necessity", "forms": ["driven by necessity", "necessity drove", "necessity compelled", "for mere necessity", "by necessity"], "weight": 3, "kind": "phrase" },
  { "term": "i was forced", "forms": ["i was forced", "i was compelled", "i was obliged", "i was driven"], "weight": 2, "kind": "phrase" },
  { "term": "i could not help", "forms": ["i could not help", "i could not avoid", "i had no choice", "i could do no other"], "weight": 2, "kind": "phrase" },
  { "term": "the reader must", "forms": ["the reader must", "the reader will", "the reader may", "let the reader"], "weight": 3, "kind": "phrase" },
  { "term": "let none judge", "forms": ["let none judge", "let no one judge", "judge me not", "who can blame"], "weight": 3, "kind": "phrase" },
  { "term": "who could have", "forms": ["who could have done otherwise", "what could i do", "what else could i", "who would not have"], "weight": 3, "kind": "phrase" },
  { "term": "i was tempted", "forms": ["i was tempted", "the devil tempted", "the temptation was"], "weight": 2, "kind": "phrase" },
  { "term": "not my fault", "forms": ["not my fault", "no fault of mine", "through no fault"], "weight": 3, "kind": "phrase" },
  { "term": "i meant no", "forms": ["i meant no harm", "i intended no", "i meant well"], "weight": 2, "kind": "phrase" },
  { "term": "any one in my", "forms": ["any one in my circumstances", "anyone in my place", "in my condition would"], "weight": 3, "kind": "phrase" },
  { "term": "i appeal", "forms": ["i appeal to", "i leave it to the world", "let the world judge"], "weight": 3, "kind": "phrase" },
  { "term": "hard fate", "forms": ["my hard fate", "my unhappy fate", "my cruel fortune", "my misfortunes"], "weight": 2, "kind": "phrase" },
  { "term": "excuse me", "forms": ["must excuse me", "will excuse me", "may excuse"], "weight": 2, "kind": "phrase" },
  { "term": "i protest", "forms": ["i protest", "i solemnly declare", "i do assure the reader"], "weight": 2, "kind": "phrase" }
] }
```

`src/lexicons/retraction.json` (S4 phrase component):
```json
{ "category": "retraction", "entries": [
  { "term": "but in truth", "forms": ["but in truth", "but the truth is", "but the truth was", "in truth however"], "weight": 3, "kind": "phrase" },
  { "term": "to confess the truth", "forms": ["to confess the truth", "to own the truth", "to tell the truth", "truth to tell"], "weight": 2, "kind": "phrase" },
  { "term": "i falsely said", "forms": ["as i falsely said", "i falsely", "which was false", "this was not true"], "weight": 3, "kind": "phrase" },
  { "term": "i must own", "forms": ["i must own", "i must confess", "i must acknowledge", "i cannot deny"], "weight": 2, "kind": "phrase" },
  { "term": "as i said before but", "forms": ["contrary to what i said", "though i said", "notwithstanding what i said"], "weight": 3, "kind": "phrase" },
  { "term": "i concealed", "forms": ["i concealed", "i hid from", "i did not tell", "i kept from"], "weight": 2, "kind": "phrase" },
  { "term": "i pretended", "forms": ["i pretended", "i feigned", "i made as if", "i made him believe", "i made her believe", "i made them believe"], "weight": 3, "kind": "phrase" },
  { "term": "in reality", "forms": ["in reality", "in fact however", "but really"], "weight": 1, "kind": "phrase" },
  { "term": "i now confess", "forms": ["i now confess", "i here confess", "i confess now"], "weight": 2, "kind": "phrase" },
  { "term": "passed for", "forms": ["i passed for", "i went by the name", "under the name of"], "weight": 2, "kind": "phrase" }
] }
```

- [ ] **Step 4: Implement the loader**

```ts
// src/engine/lexicons.ts
import vice from '../lexicons/vice.json';
import virtue from '../lexicons/virtue.json';
import selfPresentation from '../lexicons/selfPresentation.json';
import hedging from '../lexicons/hedging.json';
import justification from '../lexicons/justification.json';
import retraction from '../lexicons/retraction.json';

export interface LexiconEntry {
  term: string;
  forms: string[];
  weight: number;
  polarity?: 1 | -1;          // selfPresentation only
  kind?: 'word' | 'phrase';
}

export interface Lexicon {
  category: string;
  entries: LexiconEntry[];
  formIndex: Map<string, LexiconEntry>;   // word-kind forms only
  phrases: { form: string; entry: LexiconEntry }[];
}

export interface Lexicons {
  vice: Lexicon; virtue: Lexicon; selfPresentation: Lexicon;
  hedging: Lexicon; justification: Lexicon; retraction: Lexicon;
}

function build(raw: { category: string; entries: LexiconEntry[] }): Lexicon {
  const formIndex = new Map<string, LexiconEntry>();
  const phrases: Lexicon['phrases'] = [];
  for (const e of raw.entries) {
    for (const f of e.forms) {
      if (e.kind === 'phrase') phrases.push({ form: f, entry: e });
      else formIndex.set(f, e);
    }
  }
  return { category: raw.category, entries: raw.entries, formIndex, phrases };
}

let cached: Lexicons | null = null;
export function loadLexicons(): Lexicons {
  if (!cached) {
    cached = {
      vice: build(vice as never), virtue: build(virtue as never),
      selfPresentation: build(selfPresentation as never),
      hedging: build(hedging as never), justification: build(justification as never),
      retraction: build(retraction as never),
    };
  }
  return cached;
}
```

- [ ] **Step 5: Run to verify pass** — `npx vitest run tests/engine/lexicons.test.ts` → PASS.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: seed lexicons (vice, virtue, self-presentation, hedging, justification, retraction)"`

---

### Task 10: Attribution and evidence extraction

The heart of the engine: scans sentences, attributes deeds to first-person agency, handles negation, finds phrase hits and negation-reversal contradictions, and emits `EvidenceHit[]`.

**Files:**
- Create: `src/engine/attribution.ts`
- Test: `tests/engine/attribution.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/attribution.test.ts
import { describe, it, expect } from 'vitest';
import { extractEvidence } from '../../src/engine/attribution';
import { loadLexicons } from '../../src/engine/lexicons';

const lex = loadLexicons();
const sig = (text: string) => extractEvidence(text, lex).map(h => h.signal + ':' + h.term);

describe('deed attribution', () => {
  it('counts first-person vice deeds', () => {
    expect(sig('I stole the watch from the gentleman.')).toContain('viceDeed:steal');
  });
  it('does not count third-person deeds', () => {
    expect(sig('He stole the watch from the gentleman.')).not.toContain('viceDeed:steal');
  });
  it('does not count negated first-person deeds', () => {
    expect(sig('I never stole anything in my life.')).not.toContain('viceDeed:steal');
  });
  it('counts first-person virtue deeds', () => {
    expect(sig('I repented of my wickedness with many tears.')).toContain('virtueDeed:repent');
  });
});

describe('self-presentation', () => {
  it('catches virtue terms applied to the self', () => {
    expect(sig('I was ever an honest woman, whatever they said.')).toContain('selfVirtue:honest self');
  });
  it('catches vice terms applied to the self', () => {
    expect(sig('What a wicked creature I had become.')).toContain('selfVice:wicked self');
  });
  it('ignores moral terms applied to others', () => {
    expect(sig('She was an honest woman all her days.')).not.toContain('selfVirtue:honest self');
  });
});

describe('phrase signals', () => {
  it('finds hedging phrases', () => {
    expect(sig('I know not how it came to pass.')).toContain('hedging:i know not');
  });
  it('finds justification phrases', () => {
    expect(sig('I was driven by necessity to do what I did; let the reader judge.'))
      .toEqual(expect.arrayContaining(['justification:driven by necessity', 'justification:the reader must']));
  });
  it('finds retraction phrases', () => {
    expect(sig('I told him I was a gentlewoman of fortune; but in truth I had nothing.'))
      .toContain('retraction:but in truth');
  });
});

describe('contradiction (negation reversal)', () => {
  it('flags assert-then-negate on the same first-person verb', () => {
    const text = 'I loved him with all my heart. Years passed in that house. In truth I never loved him at all.';
    expect(sig(text).some(s => s.startsWith('contradiction:'))).toBe(true);
  });
});

describe('dialogue exclusion', () => {
  it('ignores deeds inside quoted dialogue', () => {
    expect(sig('She turned to me and said, "I stole the watch myself."'))
      .not.toContain('viceDeed:steal');
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
// src/engine/attribution.ts
import { getNlp } from './nlp';
import { maskDialogue } from './segment';
import { loadLexicons, type Lexicons } from './lexicons';
import type { EvidenceHit, Signal } from './types';

const NEGATORS = new Set(['not', 'never', 'no', 'nor', 'neither', "n't", 'nothing', 'none']);
const FP_SUBJECTS = new Set(['i', 'we']);
const FP_ANY = new Set(['i', 'me', 'my', 'mine', 'myself', 'we', 'us', 'our', 'ourselves']);

export function extractEvidence(
  processedText: string,
  lexicons: Lexicons = loadLexicons(),
  segmentIndexAt: (offset: number) => number = () => 0,
): EvidenceHit[] {
  const narration = maskDialogue(processedText);
  const hits: EvidenceHit[] = [];
  const nlp = getNlp();
  const its = nlp.its;
  const doc = nlp.readDoc(narration);

  // for contradiction detection: verb lemma -> affirmed/negated sentence info
  const verbPolarity = new Map<string, { affirmed?: string; negated?: string; offset: number }>();

  doc.sentences().each((sentence) => {
    const sentText = sentence.out();
    const sentSpan = sentence.out(its.span) as unknown as [number, number];
    const tokens: { text: string; pos: string; offset: number }[] = [];
    sentence.tokens().each((t) => {
      tokens.push({
        text: (t.out() as string).toLowerCase(),
        pos: t.out(its.pos) as string,
        offset: t.index() as unknown as number,
      });
    });

    const fpSentence = tokens.some((t) => FP_ANY.has(t.text));

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];
      const negated = isNegated(tokens, i);
      const fpAgent = hasFirstPersonSubject(tokens, i);

      // deeds: vice / virtue, first-person agency required, negation blocks
      for (const [lexName, signal] of [['vice', 'viceDeed'], ['virtue', 'virtueDeed']] as const) {
        const entry = lexicons[lexName].formIndex.get(tok.text);
        if (entry && fpAgent && !negated) {
          hits.push(makeHit(signal, entry.term, sentText, processedText, tok.text, entry.weight, segmentIndexAt));
        }
      }

      // self-presentation: moral adjective/noun in a first-person sentence
      const sp = lexicons.selfPresentation.formIndex.get(tok.text);
      if (sp && fpSentence && !negated) {
        const signal: Signal = sp.polarity === -1 ? 'selfVice' : 'selfVirtue';
        hits.push(makeHit(signal, sp.term, sentText, processedText, tok.text, sp.weight, segmentIndexAt));
      }

      // contradiction bookkeeping: first-person verbs
      if (tok.pos === 'VERB' && fpAgent) {
        const rec = verbPolarity.get(tok.text) ?? { offset: 0 };
        if (negated) rec.negated = sentText; else rec.affirmed = sentText;
        verbPolarity.set(tok.text, rec);
      }
    }
  });

  // phrase signals over lowercased narration
  const lowerNarration = narration.toLowerCase();
  for (const lexName of ['hedging', 'justification', 'retraction'] as const) {
    for (const { form, entry } of lexicons[lexName].phrases) {
      let from = 0, idx: number;
      while ((idx = lowerNarration.indexOf(form, from)) !== -1) {
        hits.push({
          signal: lexName, term: entry.term,
          sentence: sentenceAround(processedText, idx),
          charStart: idx, charEnd: idx + form.length,
          segmentIndex: segmentIndexAt(idx), weight: entry.weight,
        });
        from = idx + form.length;
      }
    }
    // single-word entries in these lexicons
    for (const [form, entry] of lexicons[lexName].formIndex) {
      const re = new RegExp(`\\b${form}\\b`, 'gi');
      let m: RegExpExecArray | null;
      while ((m = re.exec(narration)) !== null) {
        hits.push({
          signal: lexName, term: entry.term,
          sentence: sentenceAround(processedText, m.index),
          charStart: m.index, charEnd: m.index + form.length,
          segmentIndex: segmentIndexAt(m.index), weight: entry.weight,
        });
      }
    }
  }

  // contradictions: same first-person verb both affirmed and negated
  for (const [verb, rec] of verbPolarity) {
    if (rec.affirmed && rec.negated) {
      const idx = processedText.toLowerCase().indexOf(verb);
      hits.push({
        signal: 'contradiction', term: verb,
        sentence: `Affirmed: "${rec.affirmed.trim()}" — Negated: "${rec.negated.trim()}"`,
        charStart: Math.max(idx, 0), charEnd: Math.max(idx, 0) + verb.length,
        segmentIndex: segmentIndexAt(Math.max(idx, 0)), weight: 2,
      });
    }
  }

  return hits.sort((a, b) => a.charStart - b.charStart);
}

function isNegated(tokens: { text: string }[], i: number): boolean {
  for (let j = Math.max(0, i - 3); j < i; j++) {
    if (NEGATORS.has(tokens[j].text)) return true;
  }
  return false;
}

function hasFirstPersonSubject(
  tokens: { text: string; pos: string }[], i: number,
): boolean {
  // nearest preceding pronoun/noun in the clause (stop at clause boundary punctuation)
  for (let j = i - 1; j >= 0 && i - j <= 8; j--) {
    const t = tokens[j];
    if (t.text === ';' || t.text === ':') break;
    if (FP_SUBJECTS.has(t.text)) return true;
    if (t.pos === 'PRON' || t.pos === 'PROPN' || t.pos === 'NOUN') return false;
  }
  return false;
}

function makeHit(
  signal: Signal, term: string, sentence: string, fullText: string,
  surface: string, weight: number, segmentIndexAt: (o: number) => number,
): EvidenceHit {
  const idx = fullText.toLowerCase().indexOf(surface.toLowerCase());
  const start = Math.max(idx, 0);
  return {
    signal, term, sentence: sentence.trim(),
    charStart: start, charEnd: start + surface.length,
    segmentIndex: segmentIndexAt(start), weight,
  };
}

function sentenceAround(text: string, offset: number): string {
  const start = Math.max(text.lastIndexOf('.', offset), text.lastIndexOf('\n', offset)) + 1;
  let end = text.indexOf('.', offset);
  if (end === -1) end = Math.min(text.length, offset + 200);
  return text.slice(start, end + 1).trim();
}
```

Implementation notes for the executing engineer:
- wink-nlp API specifics (`its.span`, `t.index()`) may differ slightly by version — consult `node_modules/wink-nlp/types` and adapt; the *behavior* in the tests is the contract, not these exact calls.
- `makeHit`'s offset lookup via `indexOf` is approximate when a surface form repeats; if tests need exactness, thread real token offsets through (wink-nlp `its.offset` provides them). Do that if available — it's strictly better.

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/engine/attribution.test.ts` → PASS. Expect iteration here; this is the hardest module. Debug with `console.log(tokens)` on failing cases, adjust `hasFirstPersonSubject` window if needed.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: evidence extraction with first-person attribution and negation handling"`

---

### Task 11: Judgment 3 — morality scores

**Files:**
- Create: `src/engine/judgment3.ts`
- Test: `tests/engine/judgment3.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/judgment3.test.ts
import { describe, it, expect } from 'vitest';
import { scoreMorality } from '../../src/engine/judgment3';
import type { EvidenceHit } from '../../src/engine/types';

const hit = (signal: EvidenceHit['signal'], weight = 2): EvidenceHit => ({
  signal, term: 't', sentence: 's', charStart: 0, charEnd: 1, segmentIndex: 0, weight,
});

describe('scoreMorality', () => {
  it('scores all-vice deeds strongly negative', () => {
    const m = scoreMorality(Array(10).fill(hit('viceDeed', 3)));
    expect(m.deeds).toBeLessThan(-60);
    expect(m.deedsBand).toBe('immoral');
  });
  it('scores all-virtue deeds strongly positive', () => {
    const m = scoreMorality(Array(10).fill(hit('virtueDeed', 3)));
    expect(m.deeds).toBeGreaterThan(60);
  });
  it('scores mixed evidence near zero', () => {
    const m = scoreMorality([...Array(5).fill(hit('viceDeed')), ...Array(5).fill(hit('virtueDeed'))]);
    expect(Math.abs(m.deeds)).toBeLessThan(20);
  });
  it('dampens scores from very little evidence', () => {
    const m = scoreMorality([hit('viceDeed', 3)]);
    expect(m.deeds).toBeGreaterThan(-40); // one hit should not yield "immoral"
  });
  it('computes self-presentation independently of deeds', () => {
    const m = scoreMorality([
      ...Array(10).fill(hit('viceDeed', 3)),
      ...Array(10).fill(hit('selfVirtue', 2)),
    ]);
    expect(m.deeds).toBeLessThan(-60);
    expect(m.selfPresentation).toBeGreaterThan(40);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
// src/engine/judgment3.ts
import type { EvidenceHit, MoralityResult } from './types';
import { moralBand } from './types';

function polarity(positive: number, negative: number): number {
  const total = positive + negative;
  if (total === 0) return 0;
  const raw = (100 * (positive - negative)) / total;
  return raw * Math.min(1, total / 10); // dampen tiny-evidence scores
}

export function scoreMorality(hits: EvidenceHit[]): MoralityResult {
  const sum = (signal: EvidenceHit['signal']) =>
    hits.filter((h) => h.signal === signal).reduce((a, h) => a + h.weight, 0);

  const deeds = polarity(sum('virtueDeed'), sum('viceDeed'));
  const selfPresentation = polarity(sum('selfVirtue'), sum('selfVice'));

  return {
    deeds, selfPresentation,
    deedsBand: moralBand(deeds),
    selfPresentationBand: moralBand(selfPresentation),
  };
}
```

- [ ] **Step 4: Run to verify pass** — PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: dual morality scoring (deeds vs self-presentation)"`

---

### Task 12: Judgment 2 — reliability index

**Files:**
- Create: `src/engine/judgment2.ts`
- Test: `tests/engine/judgment2.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/judgment2.test.ts
import { describe, it, expect } from 'vitest';
import { scoreReliability } from '../../src/engine/judgment2';
import type { EvidenceHit, MoralityResult } from '../../src/engine/types';

const hit = (signal: EvidenceHit['signal'], weight = 2): EvidenceHit => ({
  signal, term: 't', sentence: 's', charStart: 0, charEnd: 1, segmentIndex: 0, weight,
});
const neutralMorality: MoralityResult = {
  deeds: 0, selfPresentation: 0, deedsBand: 'ambiguous', selfPresentationBand: 'ambiguous',
};

describe('scoreReliability', () => {
  it('gives a clean text a high index', () => {
    const r = scoreReliability([], 5000, neutralMorality);
    expect(r.index).toBeGreaterThan(90);
  });
  it('penalizes justification more than the same density of hedging', () => {
    const hedgy = scoreReliability(Array(20).fill(hit('hedging')), 5000, neutralMorality);
    const justifying = scoreReliability(Array(20).fill(hit('justification')), 5000, neutralMorality);
    expect(justifying.index).toBeLessThan(hedgy.index);
  });
  it('penalizes the deed/word gap (pious talk, vicious deeds)', () => {
    const hypocrite: MoralityResult = {
      deeds: -70, selfPresentation: 50, deedsBand: 'immoral', selfPresentationBand: 'mostly virtuous',
    };
    const r = scoreReliability([], 5000, hypocrite);
    expect(r.signals.s3).toBeCloseTo(60); // (50 - -70) / 2
    expect(r.index).toBeLessThan(scoreReliability([], 5000, neutralMorality).index);
  });
  it('does not reward virtue gaps in the other direction', () => {
    const humble: MoralityResult = {
      deeds: 50, selfPresentation: -20, deedsBand: 'mostly virtuous', selfPresentationBand: 'ambiguous',
    };
    expect(scoreReliability([], 5000, humble).signals.s3).toBe(0);
  });
  it('clamps to 0..100', () => {
    const r = scoreReliability(Array(500).fill(hit('retraction', 3)), 1000, neutralMorality);
    expect(r.index).toBeGreaterThanOrEqual(0);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
// src/engine/judgment2.ts
import type { EvidenceHit, MoralityResult, ReliabilityResult } from './types';
import { clamp } from './types';

// Signal weights per the spec: S1 hedging = 1; S2, S3, S4 = 2.
const W1 = 1, W2 = 2, W3 = 2, W4 = 2;
// Density scaling: a weighted-hit density of 10 per 1000 words = full penalty contribution.
const DENSITY_SCALE = 10;

export function scoreReliability(
  hits: EvidenceHit[],
  recognizedWordCount: number,
  morality: MoralityResult,
): ReliabilityResult {
  const per1k = (signals: EvidenceHit['signal'][]) =>
    (hits.filter((h) => signals.includes(h.signal)).reduce((a, h) => a + h.weight, 0) /
      Math.max(recognizedWordCount, 1)) * 1000;

  const s1 = per1k(['hedging']);
  const s2 = per1k(['justification']);
  const s4 = per1k(['retraction', 'contradiction']);
  const s3 = Math.max(0, morality.selfPresentation - morality.deeds) / 2; // 0..100

  const penalty =
    (W1 * Math.min(s1 * DENSITY_SCALE, 100) +
     W2 * Math.min(s2 * DENSITY_SCALE, 100) +
     W4 * Math.min(s4 * DENSITY_SCALE, 100) +
     W3 * s3) / (W1 + W2 + W3 + W4);

  return { index: clamp(100 - penalty, 0, 100), signals: { s1, s2, s3, s4 } };
}
```

- [ ] **Step 4: Run to verify pass** — PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: weighted reliability index (Judgment 2)"`

---

### Task 13: Engine orchestrator

**Files:**
- Create: `src/engine/engine.ts`
- Test: `tests/engine/engine.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/engine.test.ts
import { describe, it, expect } from 'vitest';
import { analyze } from '../../src/engine/engine';

const FP_VICIOUS = `CHAPTER I
I was an honest woman, the reader must believe, and ever virtuous.
But I stole a gold watch from the gentleman, and I robbed the child of her necklace.
I cheated the mercer and deceived my husband; I was driven by necessity, let none judge me.
CHAPTER II
I pretended I was a gentlewoman of fortune; but in truth I had nothing.
I stole again from the shops, yet I was ever an innocent and pious creature.`;

const TP = `She walked to town. He followed her. They spoke of the weather and their friends.
He thought her agreeable; she found him dull. Their acquaintance continued for some years.`;

describe('analyze', () => {
  it('produces a full report for a first-person text', () => {
    const r = analyze(FP_VICIOUS, 'Test Narrative');
    expect(r.perspective.verdict).toBe('first-person');
    expect(r.reliability).not.toBeNull();
    expect(r.morality).not.toBeNull();
    expect(r.morality!.deeds).toBeLessThan(0);
    expect(r.morality!.selfPresentation).toBeGreaterThan(r.morality!.deeds);
    expect(r.reliability!.index).toBeLessThan(70);
    expect(r.evidence.length).toBeGreaterThan(4);
    expect(r.segments.length).toBe(2);
    expect(r.methodologyVersion).toBeTruthy();
  });
  it('stops after Judgment 1 for third-person texts', () => {
    const r = analyze(TP, 'Third Person');
    expect(r.perspective.verdict).toBe('third-person');
    expect(r.reliability).toBeNull();
    expect(r.morality).toBeNull();
    expect(r.evidence).toHaveLength(0);
  });
  it('reports OCR quality', () => {
    const r = analyze('fhe ' + FP_VICIOUS, 'OCR Test');
    expect(r.ocr.corrections.length).toBeGreaterThan(0);
  });
  it('assigns evidence to the right segment', () => {
    const r = analyze(FP_VICIOUS, 'Segments');
    const ch2Hits = r.evidence.filter(h => h.segmentIndex === 1);
    expect(ch2Hits.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run all engine tests** — `npx vitest run tests/engine` → ALL PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: analyze() orchestrator wiring the full pipeline"`

---

### Task 14: Web Worker and client

**Files:**
- Create: `src/engine/worker.ts`, `src/engine/workerClient.ts`

Worker logic is a thin wrapper around the already-tested `analyze()`; verify via build + Task 15's manual check rather than unit tests.

- [ ] **Step 1: Implement worker**

```ts
// src/engine/worker.ts
import { analyze } from './engine';

self.onmessage = (e: MessageEvent<{ id: number; text: string; title: string }>) => {
  const { id, text, title } = e.data;
  try {
    const report = analyze(text, title);
    // processedText can be huge; it transfers fine via structured clone
    (self as unknown as Worker).postMessage({ id, ok: true, report });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, ok: false, error: String(err) });
  }
};
```

```ts
// src/engine/workerClient.ts
import type { AnalysisReport } from './types';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: AnalysisReport) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; ok: boolean; report?: AnalysisReport; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.ok && e.data.report) p.resolve(e.data.report);
      else p.reject(new Error(e.data.error ?? 'analysis failed'));
    };
  }
  return worker;
}

export function analyzeInWorker(text: string, title: string): Promise<AnalysisReport> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, text, title });
  });
}
```

- [ ] **Step 2: Verify build** — `npx tsc --noEmit && npm run build` → no errors.

- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: web worker wrapper for the analysis engine"`

---

### Task 15: UI shell and input view

**Files:**
- Create: `src/ui/inputView.ts`, `public/corpus/corpus.json` (placeholder manifest: `[]` until Task 20)
- Modify: `src/ui/main.ts`, `src/ui/styles.css`
- Test: `tests/ui/inputView.test.ts`

- [ ] **Step 1: Write failing smoke test**

```ts
// tests/ui/inputView.test.ts
import { describe, it, expect } from 'vitest';
import { renderInputView } from '../../src/ui/inputView';

describe('renderInputView', () => {
  it('renders paste box, file input, and analyze button', () => {
    const el = document.createElement('div');
    renderInputView(el, () => {});
    expect(el.querySelector('textarea')).toBeTruthy();
    expect(el.querySelector('input[type="file"]')).toBeTruthy();
    expect(el.querySelector('button#analyze-btn')).toBeTruthy();
  });
  it('invokes the callback with pasted text on analyze', () => {
    const el = document.createElement('div');
    let received: { title: string; text: string }[] = [];
    renderInputView(el, (texts) => { received = texts; });
    el.querySelector('textarea')!.value = 'I was born in Newgate.';
    (el.querySelector('#analyze-btn') as HTMLButtonElement).click();
    expect(received).toHaveLength(1);
    expect(received[0].text).toContain('Newgate');
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
// src/ui/inputView.ts
export interface TextInput { title: string; text: string }

export function renderInputView(
  root: HTMLElement,
  onAnalyze: (texts: TextInput[]) => void,
): void {
  root.innerHTML = `
    <section class="input-view">
      <h1>EvilI</h1>
      <p class="tagline">Detecting unreliable first-person narrators in
        eighteenth-century British texts. Analysis runs entirely in your browser
        &mdash; nothing you paste or upload ever leaves this page.
        <a href="methodology.html">How it works</a></p>
      <textarea id="paste-box" rows="10"
        placeholder="Paste a passage or a whole novel here&hellip;"></textarea>
      <div class="upload-zone">
        <label>Or upload .txt / TEI-XML files (several at once for comparison):
          <input type="file" id="file-input" multiple accept=".txt,.xml" />
        </label>
      </div>
      <div id="corpus-shelf" class="corpus-shelf"><h2>Or try a sample</h2></div>
      <button id="analyze-btn">Analyze</button>
      <p class="error" id="input-error" hidden></p>
    </section>`;

  const files: TextInput[] = [];
  const fileInput = root.querySelector<HTMLInputElement>('#file-input')!;
  fileInput.addEventListener('change', async () => {
    files.length = 0;
    for (const f of fileInput.files ?? []) {
      files.push({ title: f.name.replace(/\.(txt|xml)$/i, ''), text: await f.text() });
    }
  });

  loadCorpusShelf(root.querySelector('#corpus-shelf')!, onAnalyze);

  root.querySelector('#analyze-btn')!.addEventListener('click', () => {
    const pasted = root.querySelector<HTMLTextAreaElement>('#paste-box')!.value.trim();
    const texts: TextInput[] = [...files];
    if (pasted) texts.unshift({ title: 'Pasted text', text: pasted });
    const errEl = root.querySelector<HTMLElement>('#input-error')!;
    if (texts.length === 0) {
      errEl.textContent = 'Paste some text or choose a file first.';
      errEl.hidden = false;
      return;
    }
    errEl.hidden = true;
    onAnalyze(texts);
  });
}

interface CorpusItem { title: string; author: string; year: string; hook: string; file: string }

async function loadCorpusShelf(shelf: HTMLElement, onAnalyze: (t: TextInput[]) => void) {
  try {
    const base = import.meta.env.BASE_URL;
    const items: CorpusItem[] = await (await fetch(`${base}corpus/corpus.json`)).json();
    for (const item of items) {
      const card = document.createElement('button');
      card.className = 'corpus-card';
      card.innerHTML = `<strong>${item.title}</strong><br>${item.author}, ${item.year}<br><em>${item.hook}</em>`;
      card.addEventListener('click', async () => {
        const text = await (await fetch(`${base}corpus/${item.file}`)).text();
        onAnalyze([{ title: item.title, text }]);
      });
      shelf.appendChild(card);
    }
  } catch { /* corpus optional in dev */ }
}
```

Update `src/ui/main.ts`:

```ts
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
```

(`resultsView` is created in Task 16; until then add a temporary stub `src/ui/resultsView.ts` exporting `showResults` that renders `JSON.stringify(reports[0].perspective)` — replaced next task.)

Add basic styles to `src/ui/styles.css` (typography, cards, layout — serif body via `font-family: Georgia, 'Iowan Old Style', serif`, max-width 60rem centered, `.corpus-card` bordered buttons, color variables for the six signal categories used in Task 16: `--c-hedging:#8e7cc3; --c-justification:#e69138; --c-retraction:#cc0000; --c-contradiction:#990000; --c-vice:#b45309; --c-virtue:#2e7d32; --c-self:#1d6fa5`).

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/ui/inputView.test.ts` → PASS.

- [ ] **Step 5: Manual check** — `npm run dev`, open the URL, paste a paragraph, click Analyze; the stub renders perspective JSON. Verify in the browser console that no errors occur and the worker responds.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: app shell and input view (paste, upload, corpus shelf)"`

---

### Task 16: Results view — verdict cards, evidence explorer, OCR banner

**Files:**
- Create: `src/ui/resultsView.ts` (replace stub)
- Modify: `src/ui/styles.css`
- Test: `tests/ui/resultsView.test.ts`

- [ ] **Step 1: Write failing smoke test**

```ts
// tests/ui/resultsView.test.ts
import { describe, it, expect } from 'vitest';
import { showResults } from '../../src/ui/resultsView';
import { analyze } from '../../src/engine/engine';

const FP = `I stole the watch and I robbed the house; I was driven by necessity.
The reader must believe I was ever an honest and pious woman. I know not how it began.`;

describe('showResults', () => {
  const report = analyze(FP, 'Smoke Test');
  it('renders three verdict cards', () => {
    const el = document.createElement('div');
    showResults(el, [report], () => {});
    expect(el.querySelectorAll('.verdict-card').length).toBe(3);
    expect(el.textContent).toContain('first-person');
  });
  it('renders highlighted evidence in the explorer', () => {
    const el = document.createElement('div');
    showResults(el, [report], () => {});
    expect(el.querySelectorAll('mark.evidence').length).toBeGreaterThan(2);
  });
  it('grays out reliability and morality for third-person texts', () => {
    const tp = analyze('She walked out. He saw her. They spoke of their plans together often.', 'TP');
    const el = document.createElement('div');
    showResults(el, [tp], () => {});
    expect(el.querySelectorAll('.verdict-card.disabled').length).toBe(2);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
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
    // comparison entry point added in Task 18
    const slot = document.createElement('div');
    slot.id = 'comparison-slot';
    root.appendChild(slot);
    import('./comparisonView').then(({ renderComparison }) =>
      renderComparison(slot, reports, (r) => renderSingle(root, r)),
    ).catch(() => {});
  }
  renderSingle(root, reports[0]);
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
       <strong>${SIGNAL_LABELS[h.signal]}</strong> (“${escapeHtml(h.term)}”, w${h.weight}):
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
```

Add CSS: `.verdict-cards` 3-column grid; `.verdict-card.disabled { opacity:.4 }`; `mark.evidence` per-signal background colors using the Task 15 variables; `.filtered { display:none }` for list items and `background:transparent` for marks; `.explorer` two-pane grid (text 2fr, hit list 1fr, both `max-height:70vh; overflow:auto`); `.ocr-banner` amber background; `.estimate-note` small gray italic.

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/ui/resultsView.test.ts` → PASS. (Dynamic chart/export imports fail silently in tests — that's the `.catch(() => {})`.)

- [ ] **Step 5: Manual check** — `npm run dev`; paste the Moll-like test paragraph; verify cards, highlights, filters, click-to-scroll.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: results view with verdict cards and evidence explorer"`

---

### Task 17: SVG charts with PNG/SVG export

**Files:**
- Create: `src/ui/charts.ts`
- Test: `tests/ui/charts.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/ui/charts.test.ts
import { describe, it, expect } from 'vitest';
import { lineChartSvg, scatterSvg } from '../../src/ui/charts';

describe('lineChartSvg', () => {
  it('renders an SVG with one polyline per series and a title', () => {
    const svg = lineChartSvg({
      title: 'Narrative arc — Test',
      labels: ['Ch 1', 'Ch 2', 'Ch 3'],
      series: [
        { name: 'Reliability', color: '#1d6fa5', values: [80, 60, 40] },
        { name: 'Deeds', color: '#b45309', values: [10, -30, -70] },
      ],
      yMin: -100, yMax: 100,
    });
    expect(svg).toContain('<svg');
    expect((svg.match(/<polyline/g) ?? []).length).toBe(2);
    expect(svg).toContain('Narrative arc — Test');
  });
});

describe('scatterSvg', () => {
  it('renders a circle per point and a diagonal reference line', () => {
    const svg = scatterSvg({
      title: 'Deeds vs self-presentation',
      points: [{ label: 'Moll', x: -60, y: 40 }, { label: 'Pamela', x: 50, y: 60 }],
    });
    expect((svg.match(/<circle/g) ?? []).length).toBe(2);
    expect(svg).toContain('<line');
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run to verify pass** — PASS.

- [ ] **Step 5: Manual check** — dev server; analyze a multi-chapter paste (use the Task 13 `FP_VICIOUS` text); verify the arc chart renders and both download buttons produce files.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "feat: SVG charts (narrative arc, scatter) with PNG/SVG export"`

---

### Task 18: Comparison view

**Files:**
- Create: `src/ui/comparisonView.ts`
- Test: `tests/ui/comparisonView.test.ts`

- [ ] **Step 1: Write failing smoke test**

```ts
// tests/ui/comparisonView.test.ts
import { describe, it, expect } from 'vitest';
import { renderComparison } from '../../src/ui/comparisonView';
import { analyze } from '../../src/engine/engine';

const A = analyze('I stole the purse and I cheated him; but in truth I was driven by necessity. I was ever honest.', 'Thief');
const B = analyze('I prayed daily and I gave alms to the poor; I laboured with diligence and thanked God.', 'Saint');

describe('renderComparison', () => {
  it('renders one row per text with scores', () => {
    const el = document.createElement('div');
    renderComparison(el, [A, B], () => {});
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
    expect(el.textContent).toContain('Thief');
    expect(el.textContent).toContain('Saint');
  });
  it('sorts by clicked column', () => {
    const el = document.createElement('div');
    renderComparison(el, [A, B], () => {});
    (el.querySelector('th[data-key="deeds"]') as HTMLElement).click();
    const firstRow = el.querySelector('tbody tr')!;
    expect(firstRow.textContent).toContain('Thief'); // ascending: most immoral first
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
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
      wireChartExport(slot, svg, 'evili-comparison-scatter');
    }
  };
  draw();
}

const fmt = (n: number) => Number.isNaN(n) ? '—' : n.toFixed(0);
const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
```

- [ ] **Step 4: Run to verify pass** — PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: cross-text comparison table and scatter"`

---

### Task 19: Data export (JSON/CSV)

**Files:**
- Create: `src/ui/export.ts`
- Test: `tests/ui/export.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/ui/export.test.ts
import { describe, it, expect } from 'vitest';
import { reportToJson, reportsToCsv, hitsToCsv } from '../../src/ui/export';
import { analyze } from '../../src/engine/engine';

const r = analyze('I stole the watch; but in truth I was ever an honest woman. I know not why.', 'Export Test');

describe('export serialization', () => {
  it('JSON round-trips the full report minus the bulky text', () => {
    const parsed = JSON.parse(reportToJson(r));
    expect(parsed.title).toBe('Export Test');
    expect(parsed.methodologyVersion).toBeTruthy();
    expect(parsed.evidence.length).toBeGreaterThan(0);
    expect(parsed.processedText).toBeUndefined(); // excluded: texts may be in-copyright
  });
  it('CSV has a header and one row per text', () => {
    const csv = reportsToCsv([r]);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toContain('reliability');
    expect(lines).toHaveLength(2);
  });
  it('hits CSV has one row per evidence hit and escapes quotes', () => {
    const csv = hitsToCsv(r);
    expect(csv.trim().split('\n').length).toBe(r.evidence.length + 1);
  });
});
```

- [ ] **Step 2: Run to verify failure** — FAIL.

- [ ] **Step 3: Implement**

```ts
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
```

- [ ] **Step 4: Run to verify pass** — PASS.

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: JSON/CSV data export with methodology version stamp"`

---

### Task 20: Sample corpus and validation suite

**Files:**
- Create: `scripts/fetch-corpus.mjs`, `public/corpus/corpus.json`, `tests/validation.test.ts`

- [ ] **Step 1: Write the fetch script**

```js
// scripts/fetch-corpus.mjs — run once with: node scripts/fetch-corpus.mjs
import { writeFile, mkdir } from 'node:fs/promises';

// Gutenberg IDs — VERIFY each at gutenberg.org before relying on it
// (search the title; IDs below are best-known candidates).
const CORPUS = [
  { id: 370,   file: 'moll-flanders.txt', title: 'Moll Flanders', author: 'Daniel Defoe', year: '1722', hook: "Defoe's repentant thief tells her own story" },
  { id: 376,   file: 'plague-year.txt',   title: 'A Journal of the Plague Year', author: 'Daniel Defoe', year: '1722', hook: 'An eyewitness account of the 1665 plague' },
  { id: 829,   file: 'gulliver.txt',      title: "Gulliver's Travels", author: 'Jonathan Swift', year: '1726', hook: 'A ship\'s surgeon among giants, midgets, and horses' },
  { id: 6124,  file: 'pamela.txt',        title: 'Pamela', author: 'Samuel Richardson', year: '1740', hook: 'Virtue rewarded — or is it? — in letters' },
  { id: 21839, file: 'roxana.txt',        title: 'Roxana', author: 'Daniel Defoe', year: '1724', hook: 'The fortunate mistress counts the cost of her rise' },
];

await mkdir('public/corpus', { recursive: true });
const manifest = [];
for (const { id, file, ...meta } of CORPUS) {
  const url = `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`;
  console.log(`fetching ${meta.title} from ${url}`);
  const res = await fetch(url);
  if (!res.ok) { console.error(`SKIP ${meta.title}: HTTP ${res.status} — verify the ID`); continue; }
  let text = await res.text();
  // strip Gutenberg boilerplate
  const start = text.search(/\*\*\* ?START OF.*\*\*\*/);
  const end = text.search(/\*\*\* ?END OF.*\*\*\*/);
  if (start !== -1 && end !== -1) text = text.slice(text.indexOf('\n', start), end);
  await writeFile(`public/corpus/${file}`, text.trim());
  manifest.push({ ...meta, file });
}
await writeFile('public/corpus/corpus.json', JSON.stringify(manifest, null, 2));
console.log(`wrote ${manifest.length} texts + manifest`);
```

- [ ] **Step 2: Run it** — `node scripts/fetch-corpus.mjs`
Expected: 5 files + manifest in `public/corpus/`. If any ID 404s, search gutenberg.org for the correct one, fix the script, re-run. Replace the Task 15 placeholder `corpus.json`.

- [ ] **Step 3: Write the validation suite**

```ts
// tests/validation.test.ts
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { analyze } from '../src/engine/engine';
import type { AnalysisReport } from '../src/engine/types';

const path = (f: string) => `public/corpus/${f}`;
const haveCorpus = ['moll-flanders.txt', 'plague-year.txt', 'pamela.txt']
  .every((f) => existsSync(path(f)));

describe.skipIf(!haveCorpus)('validation against critical consensus', () => {
  const load = (f: string, title: string): AnalysisReport =>
    analyze(readFileSync(path(f), 'utf-8'), title);

  // these are long novels; analysis is slow — share reports across assertions
  const moll = load('moll-flanders.txt', 'Moll Flanders');
  const plague = load('plague-year.txt', 'Plague Year');
  const pamela = load('pamela.txt', 'Pamela');

  it('every bundled text registers as first-person (or epistolary)', () => {
    for (const r of [moll, plague, pamela]) {
      expect(['first-person', 'mixed-epistolary']).toContain(r.perspective.verdict);
    }
  });
  it('Moll Flanders is less reliable than the Journal of the Plague Year', () => {
    expect(moll.reliability!.index).toBeLessThan(plague.reliability!.index);
  });
  it("Moll's deeds score sits below her self-presentation score", () => {
    expect(moll.morality!.deeds).toBeLessThan(moll.morality!.selfPresentation);
  });
  it("Pamela's deed/word gap is smaller than Moll's", () => {
    const gap = (r: AnalysisReport) =>
      Math.max(0, r.morality!.selfPresentation - r.morality!.deeds);
    expect(gap(pamela)).toBeLessThan(gap(moll));
  });
}, 300_000);
```

- [ ] **Step 4: Run** — `npx vitest run tests/validation.test.ts` (allow several minutes).
Expected: PASS. **If a directional assertion fails, do not weaken the test** — this is the tool disagreeing with critical consensus on an easy case. Inspect the evidence hits driving the wrong score (add a temporary `console.log` of top hits), then fix lexicon entries or attribution logic. Iterate until green. Record final corpus scores in a comment at the top of the test file (they go on the methodology page in Task 21).

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: bundled sample corpus and literary validation suite"`

(Corpus `.txt` files are public-domain Gutenberg texts; committing them is fine and required for Pages.)

---### Task 21: Methodology page, README, CITATION

**Files:**
- Create: `methodology.html`, `README.md`, `CITATION.cff`
- Modify: `vite.config.ts` (multi-page build)

- [ ] **Step 1: Add methodology.html as a second Vite entry**

In `vite.config.ts` add:
```ts
import { resolve } from 'node:path';
// inside defineConfig:
build: {
  target: 'es2022',
  rollupOptions: { input: { main: resolve(__dirname, 'index.html'),
    methodology: resolve(__dirname, 'methodology.html') } },
},
```

- [ ] **Step 2: Write methodology.html**

Static HTML (same stylesheet) with these sections — write full prose, sourcing numbers from the actual code so the page can never drift silently from implementation (every formula below is restated from the engine; when you change one, change both):

1. **What this tool does and does not do** — heuristic lexical estimates, not interpretations; the spec's limitations list verbatim.
2. **Pipeline** — TEI strip → typography → dictionary-gated OCR remediation → spelling normalization; note that evidence offsets and the displayed text are the processed text.
3. **Judgment 1** — pronoun densities in dialogue-masked narration; thresholds (fp-share ≥ 0.45 first-person, ≤ 0.2 third-person; second-person ≥ 12/1k ⇒ epistolary).
4. **Judgment 2** — the formula from `judgment2.ts` with weights S1=1, S2=S3=S4=2, density scale 10, and what each signal counts.
5. **Judgment 3** — polarity formula `100·(v−w)/(v+w)` damped by `min(1, hits/10)`; first-person-agency and negation rules; band thresholds (±20, ±60).
6. **Lexicons** — a `<div id="lexicon-tables"></div>` plus a small module script that imports the six JSON files and renders them as tables (single source of truth — the page always shows the shipped lexicons):
```html
<script type="module">
  import vice from './src/lexicons/vice.json';
  import virtue from './src/lexicons/virtue.json';
  import selfPresentation from './src/lexicons/selfPresentation.json';
  import hedging from './src/lexicons/hedging.json';
  import justification from './src/lexicons/justification.json';
  import retraction from './src/lexicons/retraction.json';
  const root = document.getElementById('lexicon-tables');
  for (const lex of [vice, virtue, selfPresentation, hedging, justification, retraction]) {
    root.insertAdjacentHTML('beforeend',
      `<h3>${lex.category} (${lex.entries.length} entries)</h3>
       <table><tr><th>term</th><th>forms</th><th>weight</th></tr>
       ${lex.entries.map(e => `<tr><td>${e.term}</td><td>${e.forms.join(', ')}</td><td>${e.weight}</td></tr>`).join('')}
       </table>`);
  }
</script>
```
7. **OCR remediation** — rules, the only-fix-if-it-creates-a-word invariant, quality threshold (5%).
8. **Validation** — the directional assertions and the recorded corpus scores from Task 20.
9. **Privacy** — analysis is in-browser; no server, no tracking, no retention — structurally impossible, not just policy.
10. **Citing this tool** — point at CITATION.cff and the methodology version.

- [ ] **Step 3: Write README.md** — what the tool is, link to the live site (`https://<user>.github.io/EvilI/`), quick start (`npm install && npm run dev`), test commands, lexicon-editing guide (JSON format, weights, how to add entries and re-run validation), repo layout.

- [ ] **Step 4: Write CITATION.cff**

```yaml
cff-version: 1.2.0
title: "EvilI: detecting unreliable first-person narrators in eighteenth-century British texts"
type: software
authors:
  - family-names: Havens
    given-names: Hilary
version: 0.1.0
date-released: "2026-06-11"
repository-code: "https://github.com/<user>/EvilI"
abstract: >
  In-browser heuristic analysis of first-person perspective, narrator
  reliability, and narrator morality in long-eighteenth-century texts.
```

(Confirm the author name/details with the project owner before committing — don't guess beyond this default.)

- [ ] **Step 5: Verify build** — `npm run build`; check `dist/methodology.html` exists and renders lexicon tables via `npm run preview`.

- [ ] **Step 6: Commit** — `git add -A && git commit -m "docs: methodology page, README, CITATION"`

---

### Task 22: GitHub Actions deployment

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Write the workflow**

```yaml
name: Test and deploy to GitHub Pages
on:
  push:
    branches: [main, master]
  workflow_dispatch:
permissions:
  contents: read
  pages: write
  id-token: write
concurrency:
  group: pages
  cancel-in-progress: true
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test          # failing tests block deployment
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Full local verification**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all green. (Validation tests are slow; that's expected in CI too.)

- [ ] **Step 3: Commit**

```powershell
git add -A && git commit -m "ci: test-gated GitHub Pages deployment"
```

- [ ] **Step 4: Publish (requires user action)**

The user must create the GitHub repository and enable Pages. Tell them:
1. Create a repo named `EvilI` (or adjust `base` in `vite.config.ts` to match the chosen name).
2. `git remote add origin <url> && git push -u origin master`
3. Repo Settings → Pages → Source: **GitHub Actions**.
4. The site appears at `https://<user>.github.io/EvilI/` after the first green workflow run.

---

## Final acceptance checklist

- [ ] `npm test` fully green, including validation suite against the bundled corpus
- [ ] Paste, .txt upload (multiple), TEI upload, and corpus cards all produce results
- [ ] Third-person text → perspective verdict only, other cards grayed out
- [ ] Evidence explorer highlights with working category filters and click-to-scroll
- [ ] Narrative arc chart renders; PNG and SVG downloads work
- [ ] Multi-text input → comparison table + scatter, row click opens detail
- [ ] JSON, metrics CSV, and evidence CSV downloads work; methodology version present in all exports
- [ ] Noisy OCR input shows the quality banner
- [ ] Methodology page renders the live lexicons
- [ ] GitHub Actions workflow green; site live on Pages
- [ ] Report to user: lexicon curation status (seed lexicons ~20–30 entries/category; spec target 50–150 is editorial work for the project owner) and the SVG-charts-instead-of-Chart.js deviation
