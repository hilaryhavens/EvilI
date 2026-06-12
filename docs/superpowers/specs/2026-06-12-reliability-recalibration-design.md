# Evil I — Reliability Recalibration Against a Labeled Corpus

**Date:** 2026-06-12
**Methodology version:** bump from 0.1.0 → 0.2.0 (formula + lexicon change)

## Problem

The reliability index in `src/engine/judgment2.ts` is miscalibrated for the tool's
stated purpose. Recorded scores rate textbook unreliable narrators as reliable:
Moll Flanders 83.0, Pamela 86.7 — both well inside the "substantially reliable"
band (≥80). The penalty formula translates evidence densities into penalties too
weakly, so almost every first-person text lands ≥60 ("reliable"). The tool that
advertises "Detecting unreliable first-person narrators" currently flags almost
nothing.

The user has supplied a labeled answer key in `corpus/`: ten long-eighteenth-century
texts (plus two contemporary touchstones) that should all read as **unreliable**.

## Goal

Recalibrate the model so it discriminates, validated against the answer key:

- The eight single-narrator corpus texts score reliability index **< 40**
  ("substantially/profoundly unreliable"): Caleb_Williams, Castle_Rackrent, Lolita,
  Love_and_Freindship, Moll_Flanders, Roxana, The_Good_Soldier, Tristram_Shandy.
- The extracted **Lovelace** letters (from *Clarissa*) score **< 40**.
- The extracted **Lady Susan** letters (from *Lady Susan*) score **< 40**.
- The extracted **Clarissa Harlowe** letters score **≥ 60** ("broadly reliable").
  This is the control: it proves the recalibration discriminates within a single
  novel rather than dragging everything down.

The two epistolary novels (*Clarissa*, *Lady Susan*) are **not** tested as whole
files — they mix reliable and unreliable correspondents, so only their extracted
single-author letters are scored. The whole-file scores are unconstrained.

## Non-goals

- No per-book hardcoded scores or special-cased titles. Calibration is by global
  formula/lexicon changes tuned empirically against the corpus as a set.
- No change to the label band thresholds in `resultsView.ts` (<40 already reads
  "substantially/profoundly unreliable").
- No UI changes.

## Approach (hybrid)

### 1. Letter extraction script — `scripts/extract-letters.mjs`

Splits the two epistolary novels into single-author fixtures so the validation can
test specific correspondents.

- **Clarissa.txt** letters are demarcated by an all-caps sender header line:
  - Lovelace: lines matching `/^(MR\.|MRS\.)?\s?LOVELACE,?\s+TO\b/` (157 letters)
  - Clarissa: lines matching `/^MISS CLARISSA HARLOWE,?\s+TO\b/` (144 letters)
  - Each letter runs from its sender header to the next sender header of *any*
    author. Concatenate all letters per target author.
- **Lady_Susan.txt** letters are demarcated by a sender line:
  - Lady Susan: lines matching `/^Lady Susan.*\sto\s/` (16 letters), header to next
    sender line.

Outputs (deterministic, re-runnable, git-ignored or committed as fixtures):
`tests/fixtures/letters/lovelace.txt`, `clarissa-harlowe.txt`, `lady-susan.txt`.

The script asserts non-trivial extracted length (e.g. > 20 000 chars each) and
fails loudly if a sender pattern matches zero letters, so silent extraction
breakage surfaces.

### 2. Formula recalibration — `src/engine/judgment2.ts`

The penalty must reach > 60 for genuinely unreliable narrators while a reliable
correspondent (Clarissa) stays < 40 penalty. Levers, tuned empirically:

- Increase density sensitivity (`DENSITY_SCALE`) and/or the per-signal caps so
  realistic hedging/justification densities contribute meaningfully.
- Consider a baseline so a neutral text sits below 60 reliability rather than at the
  current ~85, with discriminating signals pushing unreliable narrators lower.
- Preserve the existing relative orderings asserted in `tests/validation.test.ts`
  (e.g. Moll < Plague Year). The Plague Year is the legacy reliable anchor; Clarissa
  letters are the new in-corpus control.

Tuning is iterative: run the corpus, read the scores, adjust constants, repeat until
all acceptance criteria hold. No constant is chosen to hit one specific book.

### 3. Targeted lexicon additions — `src/lexicons/*.json`

Where formula tuning alone cannot separate a text without harming the Clarissa
control, add genuinely relevant terms (hedging, justification, vice) drawn from the
narrators themselves. Each addition follows the existing entry format and is
justified by appearing in the unreliable texts, not the control.

### 4. New validation suite — `tests/corpus-validation.test.ts`

`describe.skipIf` guarded on the presence of `corpus/` and the extracted fixtures
(mirrors the existing `validation.test.ts` pattern so CI without the large texts
still passes). Asserts:

- each of the eight single-narrator corpus texts: `reliability.index < 40`
  (Clarissa.txt and Lady_Susan.txt as whole files are NOT asserted)
- `lovelace.txt`: `< 40`
- `lady-susan.txt`: `< 40`
- `clarissa-harlowe.txt`: `>= 60`

Records the achieved scores in a header comment for reproducibility, as the existing
suite does.

### 5. Version + docs

- Bump `METHODOLOGY_VERSION` in `src/engine/types.ts` to `0.2.0`.
- Note the recalibration and the new corpus in `README.md` and `methodology.html`
  (validation section), including that scores changed across the version bump.

## Acceptance criteria

1. `scripts/extract-letters.mjs` produces the three fixture files from `corpus/`.
2. New corpus-validation suite passes: eight single-narrator texts + Lovelace +
   Lady Susan < 40; Clarissa ≥ 60. Whole Clarissa/Lady Susan files unconstrained.
3. Existing `tests/validation.test.ts` relative orderings still pass.
4. Full suite (`npx vitest run`) is green.
5. `METHODOLOGY_VERSION` bumped; README/methodology updated.

## Risks

- **Degenerate calibration** (everything < 40). Guarded by the Clarissa ≥ 60 control
  and the legacy Plague Year anchor.
- **Extraction drift** if Gutenberg formatting varies. Guarded by the script's
  zero-match / min-length assertions.
- **Contemporary texts** (Lolita, The Good Soldier) use modern spelling; the
  period-variant normalization is harmless but their vice/hedging signals should
  still register. Verify during tuning.
