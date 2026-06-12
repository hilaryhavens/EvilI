# Reliability Recalibration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recalibrate the Evil I reliability index so the ten labeled corpus texts (and the extracted Lovelace / Lady Susan letters) score as unreliable while extracted Clarissa Harlowe letters stay reliable, all pinned by a new validation suite.

**Architecture:** Add a letter-extraction script that splits the two epistolary novels into single-author fixtures. Add a corpus-validation test that asserts the target scores. Then increase the evidence sensitivity of `scoreReliability` (a single tunable `SENSITIVITY` multiplier on the penalty) until the validation passes — keeping a no-evidence text at index 100 so the existing unit tests and the Clarissa control still hold. Bump the methodology version and update docs.

**Tech Stack:** TypeScript, Node ESM scripts (`.mjs`), Vitest. No new dependencies.

---

## File structure

- `scripts/extract-letters.mjs` — **create.** Reads `corpus/Clarissa.txt` and `corpus/Lady_Susan.txt`, writes three single-author fixtures. Pure Node, no deps.
- `tests/fixtures/letters/lovelace.txt`, `clarissa-harlowe.txt`, `lady-susan.txt` — **generated** by the script, committed as fixtures.
- `tests/corpus-validation.test.ts` — **create.** New validation suite, `skipIf`-guarded on presence of corpus + fixtures.
- `src/engine/judgment2.ts` — **modify.** Add `SENSITIVITY` constant and apply it; no other behavior change.
- `src/engine/types.ts:1` — **modify.** Bump `METHODOLOGY_VERSION`.
- `src/lexicons/*.json` — **modify (conditional).** Only if the multiplier alone cannot separate Lovelace from Clarissa.
- `README.md`, `methodology.html` — **modify.** Note recalibration + new corpus.

---

## Task 1: Letter-extraction script

**Files:**
- Create: `scripts/extract-letters.mjs`
- Create (generated): `tests/fixtures/letters/{lovelace,clarissa-harlowe,lady-susan}.txt`

In `Clarissa.txt` the real letters carry an all-caps sender header line, e.g.
`MISS CLARISSA HARLOWE, TO MISS HOWE ...` (144 of them) and
`MR. LOVELACE, TO JOHN BELFORD, ESQ. ...` (157). The table-of-contents lines begin
with `LETTER` and are therefore not matched. In `Lady_Susan.txt` each letter is
headed `Lady Susan ... to <recipient>.` (16 of them). Each letter runs from its
sender header to the next sender header of *any* author.

- [ ] **Step 1: Write the script**

```js
// scripts/extract-letters.mjs
// Splits the epistolary corpus novels into single-author fixtures.
// Usage: node scripts/extract-letters.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'tests', 'fixtures', 'letters');
mkdirSync(outDir, { recursive: true });

const MIN_CHARS = 20_000;

// Split `text` into letters at lines matching `headerRe`. Return array of
// { sender: <full header line>, body: <header + following lines> }.
function splitLetters(text, headerRe) {
  const lines = text.split(/\r?\n/);
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    if (headerRe.test(lines[i])) starts.push(i);
  }
  const letters = [];
  for (let k = 0; k < starts.length; k++) {
    const from = starts[k];
    const to = k + 1 < starts.length ? starts[k + 1] : lines.length;
    letters.push({ sender: lines[from], body: lines.slice(from, to).join('\n') });
  }
  return letters;
}

function collect(text, headerRe, classify, label) {
  const all = splitLetters(text, headerRe);
  const chosen = all.filter((l) => classify(l.sender));
  const out = chosen.map((l) => l.body).join('\n\n');
  if (chosen.length === 0) {
    throw new Error(`extract-letters: zero letters matched for ${label}`);
  }
  if (out.length < MIN_CHARS) {
    throw new Error(`extract-letters: ${label} only ${out.length} chars (< ${MIN_CHARS})`);
  }
  console.log(`${label}: ${chosen.length} letters, ${out.length} chars`);
  return out;
}

// --- Clarissa: any all-caps "NAME, TO NAME" header line ---
const clarissaText = readFileSync(join(root, 'corpus', 'Clarissa.txt'), 'utf-8');
const clarissaHeader = /^[A-Z][A-Z.\- ]+,\s+TO\s+[A-Z]/;
writeFileSync(
  join(outDir, 'lovelace.txt'),
  collect(clarissaText, clarissaHeader,
    (s) => /^(MR\.|MRS\.)?\s*LOVELACE,\s+TO\b/.test(s), 'lovelace'),
);
writeFileSync(
  join(outDir, 'clarissa-harlowe.txt'),
  collect(clarissaText, clarissaHeader,
    (s) => /^MISS CLARISSA HARLOWE,\s+TO\b/.test(s), 'clarissa-harlowe'),
);

// --- Lady Susan: mixed-case "Lady Susan ... to <recipient>." header ---
const ladySusanText = readFileSync(join(root, 'corpus', 'Lady_Susan.txt'), 'utf-8');
const ladySusanHeader = /^[A-Z][a-zA-Z. ]+\sto\s+(Mr|Mrs|Miss|Lady|the)\b/;
writeFileSync(
  join(outDir, 'lady-susan.txt'),
  collect(ladySusanText, ladySusanHeader,
    (s) => /^Lady Susan\b.*\bto\b/.test(s), 'lady-susan'),
);

console.log('done');
```

- [ ] **Step 2: Run the script**

Run: `node scripts/extract-letters.mjs`
Expected: prints three lines like `lovelace: 157 letters, ###### chars`,
`clarissa-harlowe: 144 letters, ###### chars`, `lady-susan: 16 letters, ##### chars`,
then `done`. No error thrown.

- [ ] **Step 3: Sanity-check the fixtures**

Run: `head -3 tests/fixtures/letters/lovelace.txt && echo '---' && head -3 tests/fixtures/letters/clarissa-harlowe.txt && echo '---' && head -3 tests/fixtures/letters/lady-susan.txt`
Expected: each file begins with a sender header for the right author
(`MR. LOVELACE, TO ...`, `MISS CLARISSA HARLOWE, TO ...`, `Lady Susan ... to ...`).

- [ ] **Step 4: Commit**

```bash
git add scripts/extract-letters.mjs tests/fixtures/letters
git commit -m "Add letter-extraction script and single-author fixtures"
```

---

## Task 2: Corpus-validation suite (the failing target)

**Files:**
- Create: `tests/corpus-validation.test.ts`

This suite encodes the answer key. It will FAIL initially (the current model scores
everything reliable) — that failure output is also our baseline measurement: Vitest's
`toBeLessThan` failure prints the actual index for each text.

- [ ] **Step 1: Write the test**

```ts
// tests/corpus-validation.test.ts
//
// Answer-key validation (methodology v0.2.0). Recorded scores after recalibration:
//   (fill in achieved indices here once Task 3 passes)
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { analyze } from '../src/engine/engine';

const corpus = (f: string) => `corpus/${f}`;
const fixture = (f: string) => `tests/fixtures/letters/${f}`;

// The eight single-narrator corpus texts that must score unreliable (< 40).
// Clarissa.txt and Lady_Susan.txt as WHOLE files are intentionally excluded.
const UNRELIABLE_TEXTS = [
  'Caleb_Williams.txt', 'Castle_Rackrent.txt', 'Lolita.txt',
  'Love_and_Freindship.txt', 'Moll_Flanders.txt', 'Roxana.txt',
  'The_Good_Soldier.txt', 'Tristram_Shandy.txt',
];

const filesPresent =
  UNRELIABLE_TEXTS.every((f) => existsSync(corpus(f))) &&
  ['lovelace.txt', 'clarissa-harlowe.txt', 'lady-susan.txt'].every((f) => existsSync(fixture(f)));

const indexOf = (p: string, title: string) =>
  analyze(readFileSync(p, 'utf-8'), title).reliability!.index;

describe.skipIf(!filesPresent)('answer-key validation', () => {
  it.each(UNRELIABLE_TEXTS)('%s scores unreliable (< 40)', (f) => {
    expect(indexOf(corpus(f), f)).toBeLessThan(40);
  });

  it('Lovelace letters score unreliable (< 40)', () => {
    expect(indexOf(fixture('lovelace.txt'), 'Lovelace')).toBeLessThan(40);
  });

  it('Lady Susan letters score unreliable (< 40)', () => {
    expect(indexOf(fixture('lady-susan.txt'), 'Lady Susan')).toBeLessThan(40);
  });

  it('Clarissa Harlowe letters stay reliable (>= 60) — the control', () => {
    expect(indexOf(fixture('clarissa-harlowe.txt'), 'Clarissa')).toBeGreaterThanOrEqual(60);
  });
}, 600_000);
```

- [ ] **Step 2: Run it and record the baseline**

Run: `npx vitest run tests/corpus-validation.test.ts`
Expected: FAILS. Most `< 40` assertions fail with messages like
`expected 83 to be less than 40`. Copy the actual indices into a scratch note —
these are the v0.1.0 baselines and tell you how far each text must move.
(The Clarissa control may already pass.)

- [ ] **Step 3: Commit the test**

```bash
git add tests/corpus-validation.test.ts
git commit -m "Add answer-key corpus validation (currently red)"
```

---

## Task 3: Recalibrate the reliability formula

**Files:**
- Modify: `src/engine/judgment2.ts`

The penalty is currently averaged so realistic evidence densities barely move the
index. Introduce a single `SENSITIVITY` multiplier on the final penalty. A
no-evidence neutral text has penalty 0, so it stays at index 100 regardless of
`SENSITIVITY` — the existing unit test `gives a clean text a high index` and the
Clarissa control both depend on this. Discrimination comes from the fact that
Lovelace/Lady Susan carry far higher hedging, justification, and deed/word-gap
density than Clarissa.

- [ ] **Step 1: Add the SENSITIVITY multiplier**

Replace the body of `scoreReliability` so the penalty is scaled. The full file:

```ts
// src/engine/judgment2.ts
import type { EvidenceHit, MoralityResult, ReliabilityResult } from './types';
import { clamp } from './types';

// Signal weights per the spec: S1 hedging = 1; S2, S3, S4 = 2.
const W1 = 1, W2 = 2, W3 = 2, W4 = 2;
// Density scaling: a weighted-hit density of 10 per 1000 words = full penalty contribution.
const DENSITY_SCALE = 10;
// Global penalty sensitivity (methodology v0.2.0). The v0.1.0 model averaged the
// signal contributions, leaving genuinely unreliable narrators scoring ~85. This
// multiplier amplifies real evidence while leaving a no-evidence text at index 100.
// Tuned empirically against the labeled corpus; see tests/corpus-validation.test.ts.
const SENSITIVITY = 3.5;

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

  const penalty = SENSITIVITY *
    (W1 * Math.min(s1 * DENSITY_SCALE, 100) +
     W2 * Math.min(s2 * DENSITY_SCALE, 100) +
     W4 * Math.min(s4 * DENSITY_SCALE, 100) +
     W3 * s3) / (W1 + W2 + W3 + W4);

  return { index: clamp(100 - penalty, 0, 100), signals: { s1, s2, s3, s4 } };
}
```

- [ ] **Step 2: Confirm the unit tests still pass**

Run: `npx vitest run tests/engine/judgment2.test.ts`
Expected: PASS (all 5). The clean-text test passes because empty hits → penalty 0 →
index 100. The relative-ordering tests (justification > hedging, gap penalty) are
unaffected by a positive scalar.

- [ ] **Step 3: Run the corpus validation and tune**

Run: `npx vitest run tests/corpus-validation.test.ts`

Tuning loop — adjust **only** `SENSITIVITY` in `judgment2.ts`, re-run, repeat:
- If any unreliable text still scores ≥ 40, raise `SENSITIVITY` (e.g. 3.5 → 4.5 → 5.5).
- If the Clarissa control drops below 60, you have raised it too far — lower it.
- Goal: a single value where all eight texts + Lovelace + Lady Susan are < 40 AND
  Clarissa ≥ 60.

If no single `SENSITIVITY` separates Lovelace (< 40) from Clarissa (≥ 60) — i.e.
their raw penalties are too close — STOP and proceed to Task 4 (lexicon additions)
before settling the constant. Otherwise skip Task 4.

- [ ] **Step 4: Record achieved scores**

Edit the header comment of `tests/corpus-validation.test.ts` to list the final
achieved index for each text (read them from a passing run with `--reporter=verbose`
or a temporary `console.log`). This documents v0.2.0 outputs like the existing
`validation.test.ts` does.

- [ ] **Step 5: Run the full suite**

Run: `npx vitest run`
Expected: all suites green, including the legacy `tests/validation.test.ts` relative
orderings (Moll < Plague Year) and `tests/engine/judgment2.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add src/engine/judgment2.ts tests/corpus-validation.test.ts
git commit -m "Recalibrate reliability index against labeled corpus (v0.2.0)"
```

---

## Task 4 (conditional): Targeted lexicon additions

Do this **only** if Task 3 Step 3 found no single `SENSITIVITY` that separates
Lovelace from Clarissa. Skip otherwise.

**Files:**
- Modify: one or more of `src/lexicons/{hedging,justification,vice}.json`

The aim is to widen the penalty gap by adding terms that genuinely appear in the
unreliable narrators (Lovelace's self-justifying, scheming idiom; Lady Susan's
manipulative hedging) but not in Clarissa's earnest register — never to special-case
a title.

- [ ] **Step 1: Find candidate terms**

Run: `node -e "const fs=require('fs');const t=fs.readFileSync('tests/fixtures/letters/lovelace.txt','utf8').toLowerCase();for(const w of ['contrivance','stratagem','artifice','revenge','triumph','glory','project']){const n=(t.match(new RegExp('\\\\b'+w,'g'))||[]).length;console.log(w,n);}"`
Expected: prints frequency of each candidate in Lovelace's letters. Keep terms that
are frequent in Lovelace but (spot-check) rare in `clarissa-harlowe.txt`.

- [ ] **Step 2: Add entries**

Append justification/vice entries in the existing format. Example for
`src/lexicons/justification.json` (match the file's existing array structure):

```json
{ "term": "contrivance", "forms": ["contrivance", "contrivances", "contrive", "contrived"], "weight": 2 }
```

- [ ] **Step 3: Re-run validation and the lexicon tests**

Run: `npx vitest run tests/engine/lexicons.test.ts tests/corpus-validation.test.ts`
Expected: lexicon schema test passes; corpus validation moves toward the targets.
Return to Task 3 Step 3 to finalize `SENSITIVITY`.

- [ ] **Step 4: Commit**

```bash
git add src/lexicons tests/corpus-validation.test.ts src/engine/judgment2.ts
git commit -m "Add Lovelace/Lady Susan register terms to widen reliability gap"
```

---

## Task 5: Version bump and documentation

**Files:**
- Modify: `src/engine/types.ts:1`
- Modify: `README.md`
- Modify: `methodology.html`

- [ ] **Step 1: Bump the methodology version**

In `src/engine/types.ts`, change:

```ts
export const METHODOLOGY_VERSION = '0.1.0';
```
to:
```ts
export const METHODOLOGY_VERSION = '0.2.0';
```

- [ ] **Step 2: Update the version assertion if present**

Run: `npx vitest run tests/engine/types.test.ts tests/engine/engine.test.ts`
Expected: PASS. If a test asserts the literal `'0.1.0'`, update it to `'0.2.0'`
(search: `grep -rn "0.1.0" tests/`).

- [ ] **Step 3: Note the recalibration in README**

In `README.md`, in the "Running tests" section, add a sentence after the validation
paragraph:

```markdown
A second suite, `tests/corpus-validation.test.ts`, checks the methodology v0.2.0
recalibration against a labeled corpus in `corpus/`: ten long-eighteenth-century and
modern unreliable-narrator texts score below 40 (the "unreliable" band), and — as a
control proving the model discriminates — Clarissa Harlowe's own letters, extracted
from *Clarissa*, stay above 60 while Lovelace's letters from the same novel fall
below 40. Regenerate the extracted letter fixtures with
`node scripts/extract-letters.mjs`.
```

- [ ] **Step 4: Note the version in methodology.html**

In `methodology.html`, find the validation/version section (search for `0.1.0`) and
update the displayed methodology version to `0.2.0`, adding a one-line note that
v0.2.0 increased penalty sensitivity so the index discriminates unreliable narrators.

Run: `grep -n "0.1.0\|0.2.0" methodology.html`
Expected: the version reference now reads `0.2.0`.

- [ ] **Step 5: Final full-suite run**

Run: `npx vitest run`
Expected: all green.

- [ ] **Step 6: Commit**

```bash
git add src/engine/types.ts README.md methodology.html tests
git commit -m "Bump methodology to v0.2.0 and document corpus recalibration"
```

---

## Self-review notes

- **Spec coverage:** extraction (Task 1), corpus-validation incl. Clarissa control
  and excluded whole epistolary files (Task 2), formula recalibration (Task 3),
  conditional lexicon tuning (Task 4), version bump + docs (Task 5). All spec
  acceptance criteria are covered.
- **Constraint honored:** every recalibration keeps a no-evidence text at index 100,
  so the existing unit tests and the "flag everything" risk are both controlled.
- **No per-book hardcoding:** only global constants/lexicons change; texts are never
  special-cased by title.
