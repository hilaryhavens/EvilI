# Evil I — Build & Launch Session Record

**Date:** 2026-06-11 (continued from two earlier sessions the same day)
**Participants:** Hilary Havens (project owner) and Claude Code (Claude Fable 5)
**Outcome:** All 22 implementation tasks completed; site published at
<https://hilaryhavens.github.io/EvilI/>; post-launch polish applied.

This document is the project-documentation record of the conversation in
which Evil I went from a paused mid-build state to a live, published site.
Companion records: `docs/SESSION-LOG.txt` (per-task engineering log from
the first two sessions), `docs/BRAINSTORMING-NOTES.txt` (design phase),
`docs/superpowers/specs/2026-06-11-evili-design.md` (approved spec), and
`docs/superpowers/plans/2026-06-11-evili-implementation.md` (the 22-task
plan that drove the build).

---

## 1. Where the session started

The project resumed from a pause after Task 7 of 22 (engine foundations:
scaffold, types, dictionary, normalization, OCR remediation, TEI
stripping, segmentation — 26 tests green). Process: subagent-driven
development — a fresh implementer agent per task, followed by spec-
compliance and code-quality reviews, fixes looped back before moving on.

On resume, Task 8's files were found already written to disk (verbatim
from the plan) but uncommitted; they were verified against the plan,
committed, reviewed, and extended with extra tests.

## 2. Build highlights (Tasks 8–22)

- **Task 8 — perspective detection.** Regex pronoun densities over
  dialogue-masked narration. Review added density/empty-input tests and
  documented the match()-only regex contract.
- **Task 9 — seed lexicons.** A plan inconsistency surfaced: the test
  demanded >10 entries while the retraction lexicon has exactly 10. The
  implementer invented an 11th entry; this was rejected (fabricated
  scholarly data, duplicate forms) and the assertion relaxed to ≥10
  instead. Review also caught that the two-word form "no doubt" could
  never match as a word-kind entry (now a phrase entry) and replaced
  type-erasing `as never` casts with a checked raw-JSON shape.
- **Task 10 — evidence extraction (the heart).** Implementer improved on
  the plan using wink-nlp's `negationFlag` and real token offsets. The
  Opus quality review caught a critical off-by-one in character offsets
  (first-token leading whitespace) plus wrong-sentence resolution on
  repeated sentences and an O(n²) scan; all fixed with a monotonic
  sentence cursor and offset-roundtrip regression tests.
- **Tasks 11–14** — morality scoring, reliability index, `analyze()`
  orchestrator, web worker: verbatim per plan, all green.
- **Tasks 15–19** — input view, results view with evidence explorer,
  hand-rolled SVG charts with PNG/SVG export, comparison table +
  scatter, JSON/CSV export. (jsdom was briefly added for UI tests, then
  dropped in favor of the already-present happy-dom.)
- **Task 20 — corpus & literary validation.** Five Gutenberg novels
  bundled (Roxana's ID corrected from 21839 — which is Sense and
  Sensibility! — to 30344). **All directional assertions passed with no
  tuning:** Moll Flanders 83.0 reliability vs Plague Year 90.7; Moll's
  deeds 13.9 below her self-presentation 33.3; Pamela's hypocrisy gap
  ~0 vs Moll's 19.4.
- **Task 21 — methodology page** (every number restated from code, live
  lexicon tables), README, CITATION.cff (author: Hilary Havens,
  University of Tennessee, Knoxville).
- **Task 22 — test-gated GitHub Actions deploy.**

## 3. Final review and launch

A whole-implementation Opus review found no critical or important
issues; verdict "ready to merge." Minor fixes applied before merging:
worker-level error handling (pending analyses now reject instead of
hanging the UI), README corpus wording (five texts, three validated),
favicon consistency, dev notes moved under `docs/`.

`build` was merged fast-forward into `master`. The GitHub repo
`hilaryhavens/EvilI` was created via `gh`, master pushed, Pages enabled
with Source = GitHub Actions. First workflow run: tests green in CI,
deployed; live site verified responding (tool, methodology page, corpus
manifest).

## 4. Post-launch polish (this session's final commits)

At Hilary's request:

1. **"EvilI" → "Evil I"** in all user-facing text (titles, headings,
   prose, chart stamp, download filenames). Repo name, URLs, and the
   `/EvilI/` base path intentionally unchanged.
2. **Teal color scheme** for page chrome (links, buttons, hovers, tabs)
   via new `--accent` variables; the seven signal colors are unchanged.
3. **Garamond-first typography** (`Garamond, 'EB Garamond', 'Adobe
   Garamond Pro', 'Palatino Linotype', 'Book Antiqua', Georgia, serif`)
   for pages and SVG charts — system fonts only, so the "no network
   requests" privacy claim still holds structurally.
4. **Multi-text results toggle:** analyzing several texts now shows a
   tab bar that switches the full single-text result view between
   texts, alongside the comparison table (whose rows also switch the
   view). Covered by a new test; suite is 80 tests.

## 5. Known follow-ups (owner work, no deadline)

- **Lexicon curation:** seeds are 10–23 entries/category; the spec
  target is 50–150. Edit `src/lexicons/*.json` (format in README), then
  re-run `npx vitest run tests/validation.test.ts`.
- Accepted deviation: hand-rolled SVG charts instead of Chart.js, for
  clean SVG export.
- Minor known gaps: JSON export omits `processedText` (offsets are not
  self-resolving in isolation); evidence hits whose spans overlap an
  earlier hit appear in the sidebar but have no highlight to scroll to.
- GitHub annotation: actions runners migrate Node 20 → 24 (automatic;
  informational only).

## 6. How to verify everything, any time

```
$env:Path = 'C:\Program Files\nodejs;' + $env:Path   # if needed
npx tsc --noEmit ; npx vitest run ; npm run build
```

Any push to `master` re-runs the suite in CI and redeploys only if
green.
