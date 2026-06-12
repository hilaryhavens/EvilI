# EvilI — Narrator Analysis for Eighteenth-Century British Texts

**Live site:** https://hilaryhavens.github.io/EvilI/

EvilI is an in-browser tool that analyzes texts of the long eighteenth century in Britain and reports three things about the narrator:

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
# Full suite (79 tests)
npx vitest run

# Validation suite only (requires corpus files in public/corpus/)
npx vitest run tests/validation.test.ts
```

The validation suite runs the engine against three of the five bundled public-domain texts — *Moll Flanders*, *A Journal of the Plague Year*, and *Pamela* (the sample shelf also includes *Gulliver's Travels* and *Roxana*) — and asserts directional orderings aligned with critical consensus (e.g., Moll Flanders less reliable than the Journal). If the corpus files are absent, those tests are automatically skipped. Recorded scores for methodology v0.1.0 are in the comment at the top of `tests/validation.test.ts`.

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

See `CITATION.cff` or use GitHub's "Cite this repository" button. Please include the methodology version (currently `0.1.0`) when reporting scores in publications — lexicon revisions change outputs.

---

## License

Source code: MIT. Bundled corpus texts are public domain (Project Gutenberg).
