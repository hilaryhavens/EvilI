# Evil I — Narrator Analysis for Eighteenth-Century British Texts

**Live site:** https://hilaryhavens.github.io/EvilI/

Evil I is an in-browser tool that analyzes texts of the long eighteenth century in Britain and reports three things about the narrator:

1. **Perspective** — first-person, third-person, or mixed/epistolary (with confidence)
2. **Reliability index** (0–100; 100 = maximally reliable) — derived from hedging density, self-justification phrases, the gap between deeds and self-presentation, and explicit retractions or contradictions
3. **Morality** (two scores, each −100 to +100) — deeds attributed to first-person agency vs. the narrator's self-descriptive moral language

All analysis runs entirely in your browser. No text is sent to any server. No accounts, no tracking, no data retention — structurally impossible on a static GitHub Pages deployment.

**Methodology:** https://hilaryhavens.github.io/EvilI/methodology.html

---

## Quick start

```
npm install
npm run dev
```

Then open http://localhost:5173/EvilI/ in your browser.

---

## Running tests

```bash
# Full suite
npx vitest run

# Directional validation (requires corpus files in public/corpus/)
npx vitest run tests/validation.test.ts

# Answer-key validation (requires the larger corpus/ folder + extracted fixtures)
npx vitest run tests/corpus-validation.test.ts
```

The directional suite runs the engine against three of the five bundled public-domain texts — *Moll Flanders*, *A Journal of the Plague Year*, and *Pamela* (the sample shelf also includes *Gulliver's Travels* and *Roxana*) — and asserts orderings aligned with critical consensus (e.g., Moll Flanders less reliable than the Journal). If the corpus files are absent, those tests are automatically skipped.

The **answer-key suite** (`tests/corpus-validation.test.ts`) checks the methodology v0.2.0 recalibration against a labeled corpus in `corpus/`. v0.2.0 fixes an inverted deed-attribution (abstract virtue-*talk* was being counted as virtuous *deeds*), removes high-frequency noise forms, adds scheming/manipulation vocabulary, and weights the reliability index toward the **deed / self-presentation gap** — the most direct operationalization of an unreliable narrator (being other than one presents oneself). The suite asserts that five confessional narrators (*Moll Flanders*, *Lolita*, *Caleb Williams*, *The Good Soldier*, *Tristram Shandy*) score below 40 ("unreliable") and below the reliable control — *Clarissa Harlowe's* own letters, extracted from *Clarissa*, which stay ≥ 60. The header comment of that file records the achieved scores and honestly documents the texts the lexical model cannot separate (e.g. *Lovelace*'s letters, which score *below* Clarissa on every signal because he confesses his villainy frankly and so never misrepresents himself). Regenerate the extracted letter fixtures with `node scripts/extract-letters.mjs`. Report the methodology version (currently `0.2.0`) with any published scores.

---

## Editing lexicons

Lexicons are plain JSON files in `src/lexicons/`. You can add entries and re-run tests without touching any TypeScript code.

**Entry format:**

```json
{ "term": "deceive", "forms": ["deceive", "deceived", "deceiving", "deceit"], "weight": 2 }
```

For the `selfPresentation` lexicon, add a `"polarity"` field (`1` = positive self-image, `-1` = negative):

```json
{ "term": "innocent self", "forms": ["innocent", "innocence", "blameless"], "weight": 2, "polarity": 1 }
```

For phrase entries (hedging, justification, retraction), add `"kind": "phrase"`:

```json
{ "term": "i know not", "forms": ["i know not", "i knew not"], "weight": 2, "kind": "phrase" }
```

**Weights** run 1–3: 1 = minor signal, 2 = moderate, 3 = strong (e.g., "murder" = 3, "idleness" = 1).

**Available lexicons:**

| File | Purpose |
|------|---------|
| `vice.json` | First-person vice deeds (theft, fraud, murder, etc.) |
| `virtue.json` | First-person virtue deeds (charity, repentance, honesty, etc.) |
| `selfPresentation.json` | Self-descriptive moral language (positive + negative) |
| `hedging.json` | Uncertainty and memory-qualification phrases (S1) |
| `justification.json` | Self-justification and reader-appeal phrases (S2) |
| `retraction.json` | Explicit retraction phrases (S4) |
| `variants.json` | Period spelling variants (chuse→choose, shew→show, etc.) |

After editing, re-run the validation suite to confirm no regressions:

```bash
npx vitest run tests/validation.test.ts
```

---

## Repository layout

```
src/
  engine/          Pure TypeScript analysis engine (no UI dependencies)
    judgment1.ts   Perspective detection
    judgment2.ts   Reliability index
    judgment3.ts   Morality scores
    attribution.ts Evidence extraction (lexicon matching, negation, POS)
    ocr.ts         OCR remediation rules
    types.ts       Shared types, METHODOLOGY_VERSION, moralBand()
    engine.ts      Top-level analyze() function
    lexicons.ts    Lexicon loader
    nlp.ts         wink-nlp wrapper
    segment.ts     Dialogue masking, segment splitting
    dictionary.ts  Dictionary wrapper
  lexicons/        Hand-curated JSON word lists (see above)
  ui/              UI layer (styles, components, main entry)
  methodology/     lexiconTables.ts — renders lexicons on methodology.html
tests/
  *.test.ts        Vitest unit tests (79 tests total)
public/
  corpus/          Bundled sample texts (Moll Flanders, Plague Year, Gulliver, Pamela, Roxana)
methodology.html   Methodology documentation (Vite entry point)
index.html         Main app (Vite entry point)
CITATION.cff       Citation metadata
```

---

## Build

```bash
npm run build
```

Output goes to `dist/`. Both `dist/index.html` and `dist/methodology.html` are built as separate entry points. Deploy the `dist/` directory to any static host.

---

## Citation

See `CITATION.cff` or use GitHub's "Cite this repository" button. Please include the methodology version (currently `0.2.0`) when reporting scores in publications — lexicon and formula revisions change outputs.

---

## License

Source code: MIT. Bundled corpus texts are public domain (Project Gutenberg).
