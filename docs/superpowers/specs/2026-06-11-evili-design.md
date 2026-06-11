# EvilI — Design Specification

**Date:** 2026-06-11
**Status:** Approved design, pre-implementation

## Overview

EvilI is a static website that analyzes texts of the long eighteenth century in Britain and reports, for each text: whether it is first-person narration, how reliable the narrator is (0–100), and how moral the narrator is on a virtuous-to-immoral scale (two scores: deeds vs. self-presentation, −100 to +100). It accepts a single text or a group of texts and runs entirely in the visitor's browser — no server, no API keys, no tracking, no data retention. Deployed on GitHub Pages.

**Audience:** rigorous enough for researchers (transparent methodology, citable metrics, exportable data) and friendly enough for students and the public (plain-language verdicts, highlighted evidence, visualizations).

**Method:** in-browser NLP heuristics. All judgments are computational estimates from lexical evidence; the methodology page states plainly what each signal can and cannot detect.

## Architecture

A static single-page app: **Vite + TypeScript**, **wink-nlp** for tokenization/sentence-splitting/POS-tagging/negation, **Chart.js** for visualization, deployed to GitHub Pages by GitHub Actions on every push to `main`.

Four layers with a hard boundary between engine and UI:

1. **Ingestion** — accepts pasted text, uploaded `.txt` files (multiple), TEI/XML (markup stripped), or the bundled sample corpus. Applies OCR remediation, then typography/spelling normalization (see Lexicons & Language).
2. **Analysis engine** — a pure TypeScript module with no UI dependencies, running in a **Web Worker** (long novels must not freeze the page). Plain text in → structured JSON report out: three judgments, all sub-scores, every evidence hit with sentence, location, signal, and weight contribution. Pure function of the text = independently testable and runnable from the command line.
3. **Presentation** — verdict cards, evidence explorer, charts, comparison view.
4. **Export** — serializes the engine report to CSV/JSON; charts export as PNG and SVG.

Nothing the UI shows is computed anywhere except the engine.

## Analysis pipeline — three judgments

### Judgment 1: First-person detection

Computed per text and per chapter (catches frame narratives). Measures the ratio of first-person pronouns (*I, me, my, mine, myself, we, us, our*) to third-person narrative pronouns in **narration only** — quoted dialogue is detected and excluded, since third-person novels are full of characters saying "I." Also detects narratorial self-reference ("I shall now relate," "as I have said").

Output: verdict — **first-person / third-person / mixed or epistolary** — with confidence. *Thou/thee* in narration contributes to the epistolary signal. If the text is not first-person, the tool says so and stops; Judgments 2–3 are not computed.

### Judgment 2: Reliability index (0–100; 100 = maximally reliable)

Four signals, each a density per 1,000 recognized words (comparable across text lengths):

| Signal | Weight | Counts |
|---|---|---|
| S1 — Hedging & uncertainty | 1 | "perhaps," "methinks," "I cannot tell," "I know not," memory disclaimers ("if I remember right") |
| S2 — Self-justification & reader appeals | 2 | excuse-making tied to first-person agency ("I was driven by necessity"), reader management ("the reader must consider," "let none judge me"), rhetorical self-defense |
| S3 — Deed/word discrepancy | 2 | the gap between the two morality scores from Judgment 3 |
| S4 — Internal contradiction & retraction | 2 | retraction phrases ("but in truth," "to confess the truth," "as I falsely said") and negation reversals (assert, later negate, same lexical content) |

S1 is deliberately under-weighted: hedging alone can be period style or genuine modesty. The weighted sum is inverted and scaled to 0–100. Every hit is stored with sentence, location, signal, and weight contribution — these become the highlighted evidence passages.

### Judgment 3: Morality — two scores, reported separately

Both on −100 (immoral) to +100 (virtuous), with labeled bands: *virtuous / mostly virtuous / ambiguous / questionable / immoral*.

- **Deeds score** — vice/virtue lexicon hits counted **only when attributed to first-person agency**: "I stole" counts; "he stole" does not; negation handled ("I never stole" does not count).
- **Self-presentation score** — moral register of the narrator's self-descriptive language ("I was ever honest," "a wicked creature as I am") plus overall pious/profane diction in narration.

The gap between the two scores **is** signal S3. All scores are also computed per chapter/segment, powering the narrative-arc timeline.

Every displayed score carries the label "computational estimate from lexical evidence — see methodology."

## Lexicons & eighteenth-century language

### Lexicons as data

All word lists are human-readable JSON files in the repo (`lexicons/vice.json`, `virtue.json`, `hedging.json`, `justification.json`, `retraction.json`, `variants.json`, …). Each entry: term or phrase pattern, category, weight ("murder" outweighs "idleness"), optional note. Researchers can inspect, cite by version, and propose changes; lexicons are editable without touching code. The methodology page renders them in full.

Lexicons are hand-curated for period moral vocabulary (modern sentiment lexicons would misfire — "want," "luxury," "condescension"):

- **Vice:** theft/robbery, fraud/cheating, lying/dissembling, seduction/lewdness/whoredom, drunkenness, gaming, murder, avarice, vanity, idleness
- **Virtue:** honesty, charity, piety/devotion, repentance/penitence, industry, prudence, chastity/modesty, gratitude, duty/obedience
- **Hedging / justification / retraction:** the period phrases listed under Judgment 2, expanded with variants

Each lexicon launches with ~50–150 entries including inflected and archaic forms ("deceiv'd," "stole/stolen," "hath sinned").

### OCR remediation (applied first, esp. for ECCO-derived text)

- **Long-s misreads:** ſ OCR'd as **f** (*fhe, fome, fuch, defire, paffion*). Rule: try f→s on any unknown token; correct only if the substitution yields a known word and the original is not one. Ambiguous real-word pairs (*fame/same, fat/sat*) are left alone and logged.
- **Other confusion pairs** with the same only-fix-if-it-creates-a-word rule: rn/m, c/e, h/b, li/h, 1/l/I, 0/o, broken ligatures (ﬁ → fi).
- **Broken/run-together words:** rejoin hyphenated line-break splits (*con-tinued*); try splitting unknown run-togethers into two known words.
- **Dictionary** = standard English word list **plus** the period-variant table, so *chuse*/*shew* are "known" and never falsely corrected.
- **OCR quality score:** share of tokens still unrecognized after correction. Above threshold (~5%), the UI shows a visible warning and per-1,000-word densities use recognized tokens only. Every applied correction is logged and inspectable.
- **Scope:** rule-based remediation of common ECCO failure modes, not full OCR post-correction; the methodology page says so.

### Normalization (applied after OCR remediation)

- Long s: ſ → s
- u/v and i/j interchange (*vpon* → upon, *ioy* → joy)
- Elided preterites: *walk'd, deceiv'd, oblig'd* → walked, deceived, obliged
- Variant-spelling table (own JSON file, extensible): *chuse→choose, shew→show, compleat→complete, surprize→surprise, stile→style, &c.→etc.*
- Period capitalization of common nouns: handled by case-insensitive matching
- Archaic grammar recognized: *thou/thee/thy* as second person; *hath/doth/art/wert* — neither miscounted as narrator self-reference nor missed in phrase patterns

## UI & outputs

Principle: **verdicts first, evidence one click away, full data underneath.**

**Input screen:** paste box; drag-and-drop for `.txt`/XML (multiple); sample-corpus shelf (cards: title, author, year, one-line hook). Proposed corpus: *Moll Flanders*, *Roxana*, *Pamela*, *Gulliver's Travels*, *A Journal of the Plague Year* (public domain, bundled as static files). Plain-language explanation with a link to methodology.

**Results view (single text):**

1. **Verdict cards** — Perspective (with confidence), Reliability (index + label, e.g., "substantially unreliable"), Morality (both scores side by side, e.g., "Deeds: −62 (immoral) · Self-presentation: +38 (mostly virtuous)"). Each card: one-sentence plain-English gloss + expandable sub-scores and formulas. Non-first-person texts: perspective card explains; others gray out.
2. **Narrative arc chart** — chapter-by-chapter lines for reliability, deeds, self-presentation; hover for numbers, click to jump to that chapter's evidence.
3. **Evidence explorer** — full text with color-coded signal highlights (hedging, justification, vice deed, virtue deed, self-presentation, retraction); category filter bar; sidebar listing every hit (sentence, location, signal, weight contribution) with click-to-scroll.
4. **OCR quality banner** — only when noise is high.

**Comparison view (multiple texts):** sortable table (perspective, reliability, both morality scores, discrepancy gap, word count, OCR quality) + scatter plot of deeds vs. self-presentation (consistent narrators near the diagonal; unreliable hypocrites off it). Row click opens full results.

**Export:**

- **JSON** — complete engine report (every score and evidence hit with location)
- **CSV** — one row per text (comparison metrics) + optional per-evidence-hit CSV
- **Visualizations** — every chart downloads as **PNG** (slides) and **SVG** (publication vector), with title, text identification, and methodology version stamped into the image
- Methodology version stamped in all exports so data is citable

**Methodology page:** static page documenting each judgment's formula, signal weights, full rendered lexicons, normalization and OCR rules, validation results, and a limitations statement — written to be quotable in a paper's methods section.

**Privacy & accessibility:** no accounts, no tracking, no retention — structural, since static hosting plus in-browser analysis means no server could retain anything; stated visibly on the site. Clean readable design, projector-friendly, keyboard navigable.

## Testing, validation & deployment

**Engine unit tests (Vitest):** pronoun attribution ("I stole" counts; "he stole" doesn't; "I never stole" doesn't), dialogue exclusion, negation-reversal detection, every normalization and OCR rule including don't-touch cases (*fame* stays *fame*), TEI stripping, score math. Run on every push.

**Validation suite (literary ground truth):** the engine runs against the bundled corpus; assertions encode critical consensus **directionally** (orderings, not exact numbers): *Moll Flanders* less reliable than *A Journal of the Plague Year*; Moll's deeds score below her self-presentation score; *Pamela*'s gap smaller; every bundled text registers first-person. Lexicon refinement doesn't break tests spuriously; regressions do. Current validation results are published on the methodology page.

**Deployment:** GitHub Actions on push to `main`: install → test → build → deploy to Pages. Failing tests block deployment. Repo includes README, methodology in markdown, and a CITATION file (versioned, since lexicon revisions change scores).

**Build order:** engine core first (normalization → OCR → Judgment 1 → lexicons → Judgments 2–3), test-first throughout; then UI; then samples/comparison/export; then methodology page and deployment. A command-line-testable engine exists before any web page.

## Known limitations (stated in methodology)

- Heuristic, lexicon-based judgments — estimates, not interpretations; irony and subtle unreliability beyond explicit textual markers are out of reach.
- S4 catches explicit retractions and negation reversals, not inconsistencies requiring world-knowledge inference.
- OCR remediation is rule-based and targets common ECCO failure modes only.
- Validation is directional against a small consensus corpus, not exhaustive.
