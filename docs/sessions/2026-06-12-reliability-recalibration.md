# Evil I — Reliability Recalibration Session Record

**Date:** 2026-06-12
**Participants:** Hilary Havens (project owner) and Claude Code (Claude Opus 4.8)
**Outcome:** Methodology recalibrated v0.1.0 → v0.2.0. The reliability index, which
previously rated nearly all first-person text as reliable, now genuinely flags five
unreliable narrators while holding a reliable control — with the model's honest
limits documented rather than masked.

Companion records: `docs/superpowers/specs/2026-06-12-reliability-recalibration-design.md`
(spec, twice revised in light of evidence) and
`docs/superpowers/plans/2026-06-12-reliability-recalibration.md` (original 5-task
plan). Process: brainstorming → spec → plan → subagent-driven execution with
spec-compliance and code-quality reviews.

---

## 1. The request

Hilary supplied a new `corpus/` folder (ten public-domain texts) as a labeled answer
key: every text should read as **unreliable**, specifically the letters written by
**Lovelace** in *Clarissa* and by **Lady Susan** in *Lady Susan*, plus the eight
single-narrator works (Caleb Williams, Castle Rackrent, Lolita, Love & Freindship,
Moll Flanders, Roxana, The Good Soldier, Tristram Shandy). The whole epistolary
novels were later clarified to be exempt — only the extracted single-author letters
matter, and Clarissa Harlowe's own letters should stay **reliable** as a control.

## 2. Plan vs. reality — the baseline that overturned the plan

The approved plan assumed a single global sensitivity multiplier would push the
corpus below 40. The first measurement disproved it. The v0.1.0 model scored every
text 80–92 (reliable), and crucially the signals did **not** separate the targets
from the control — Clarissa hedged and "contradicted" *more* than Lovelace.

Diagnosis found the cause: the **deeds** score was inverted. `virtue.json` mixed
genuine deed-verbs with abstract virtue-*attributes* (`duty`, `piety`, `faithful`,
`virtue`), so a rhetorician like Lovelace who invokes "honour/duty/faithful"
registered as virtuous-acting (+53). A deeper dump revealed two more defects:
high-frequency noise words (`good`, `worthy`, `gave`) dominated the
self-presentation and virtue-deed signals, and self-presentation fired on any moral
adjective in any sentence merely *containing* a first-person pronoun (so Clarissa
calling Lovelace "a vile wretch" counted as *her* self-vice).

This was escalated to Hilary as a wrong-plan situation. She chose **"principled
rebuild, honest results"** over a curated corpus-fit: fix the real defects, flag what
the features genuinely support, document the rest, never hardcode titles.

## 3. The principled rebuild (methodology v0.2.0)

- **`virtue.json`** restricted to genuine first-person *action* verbs (repent,
  forgive, confess, restore, protect…). The abstract attributes already live in
  `selfPresentation.json`, so deeds stopped being inflated by virtue-talk.
- **Noise removal:** dropped `good`/`worthy`/`true` from `selfPresentation.json` and
  `gave` from `virtue.json` — polysemous words that fired equally everywhere and
  flattened the signal.
- **`vice.json`** gained the scheming/manipulation/cruelty vocabulary (contrive,
  plot, scheme, stratagem, revenge, intrigue, ensnare, delude, tyrannize), chosen by
  measured frequency in the unreliable narrators and gated by the existing
  first-person-subject requirement so the control's victim-narration doesn't fire.
- **`judgment2.ts`** reweighted to make the **deed / self-presentation gap (S3)** the
  heaviest signal (W3 = 4) and hedging the lightest (W1 = 1) — being other than one
  presents oneself is the most direct marker of an unreliable narrator — plus a
  global `SENSITIVITY = 3.7`. A no-evidence text still scores 100 (penalty scales
  from 0), which preserves the existing unit tests and prevents a "flag everything"
  degenerate.

## 4. Honest outcome

Achieved reliability indices (lower = more unreliable):

| Text | Index | Flagged < 40? |
|------|-------|---------------|
| Tristram Shandy | 13.3 | ✅ |
| The Good Soldier | 13.5 | ✅ |
| Moll Flanders | 25.6 | ✅ |
| Caleb Williams | 33.6 | ✅ |
| Lolita | 38.8 | ✅ |
| Lady Susan (letters) | 43.6 | ✗ (just misses) |
| **Clarissa (control)** | 60.1 | ✅ stays ≥ 60 |
| Roxana | 63.6 | ✗ |
| Lovelace (letters) | 64.6 | ✗ |
| Love & Freindship | 69.3 | ✗ |
| Castle Rackrent | 77.0 | ✗ |

**Five of ten flag correctly, and the control holds.** The documented limitation,
accepted by Hilary: Lovelace and Lady Susan — both named as must-flag — are not
flagged. Lovelace scores *below* Clarissa on every signal because he confesses his
designs frankly to Belford and so never misrepresents himself; his unreliability is
not lexical hypocrisy. Roxana, Castle Rackrent (ironic servant-narrator), and Love &
Freindship (parody) likewise show no hypocrisy gap. Pushing them under 40 would
require the curated/overfit approach Hilary declined, or a deeper rewrite of the
self-presentation attribution (require true first-person-subject attachment) whose
payoff is uncertain — their unreliability may simply not be lexical.

## 5. What shipped

- `scripts/extract-letters.mjs` + three committed fixtures under
  `tests/fixtures/letters/` (Lovelace 156 letters, Clarissa 144, Lady Susan 16).
- `tests/corpus-validation.test.ts` — asserts the five flags, the control floor, and
  flagged-below-control; header records all eleven indices and the known limits.
- Lexicon + `judgment2.ts` recalibration; `METHODOLOGY_VERSION` → `0.2.0`.
- Docs updated: README validation section, methodology.html (S3 weight 2→4,
  SENSITIVITY added to the formula, v0.2.0 recalibration note with honest limits),
  CITATION.cff.
- Two-stage review (spec compliance, then code quality) on the recalibration; fixes
  applied: three doc inconsistencies, and an `almsgiving` double-count in
  `virtue.json`.

Full suite: **87 tests green.** The legacy directional suite
(`tests/validation.test.ts`, Moll < Plague Year) still passes — but note those
recorded v0.1.0 scores (Moll 83.0 etc.) are superseded by v0.2.0.

## 6. Known follow-ups (owner work, no deadline)

- **Catching open villains / ironists.** Lovelace, Roxana, Castle Rackrent, Love &
  Freindship are invisible to the current lexical features. The most promising honest
  lever is rewriting self-presentation attribution to require a first-person *subject*
  (not just a first-person sentence), so descriptions of others stop polluting the
  signal — flagged in the spec as higher-effort, uncertain payoff.
- **Lady Susan** sits at 43.6; her strongest signal is contradiction, not hypocrisy.
  Raising the contradiction weight would catch her but tightens the Clarissa control
  margin (already only 0.1 above 60).
- Lexicon curation continues (seeds remain well below the 50–150/category target).

## 7. How to reproduce

```
node scripts/extract-letters.mjs            # regenerate letter fixtures from corpus/
npx vitest run tests/corpus-validation.test.ts   # answer-key validation
npx vitest run                              # full suite (87 tests)
```

The `corpus/` folder is git-untracked (large public-domain texts); the validation
auto-skips if it is absent.

## 8. Integration, deploy, and polish (same session, after the rebuild)

After the recalibration was reviewed, Hilary directed the remaining steps:

- **Merge & deploy.** The `recalibrate-reliability-v0.2.0` branch was merged
  `--no-ff` into `master` (tests re-verified green on the merged result, 87/87), the
  branch deleted, and `master` pushed to `origin`. The push triggered the
  `Test and deploy to GitHub Pages` workflow, which ran the suite, built, and
  deployed — v0.2.0 went live at <https://hilaryhavens.github.io/EvilI/>.
- **Light-teal background.** `--bg` in `src/ui/styles.css` changed from `#faf8f4`
  to **`#cfecec`**. Because `methodology.html` imports the same stylesheet, both the
  tool and the methodology page now carry the light-teal page background; the white
  content cards and the seven signal colors are unchanged. Build verified, pushed,
  redeployed green.
- **CI action bump.** The deploy run surfaced a GitHub deprecation notice (Node 20
  actions retiring mid-June 2026). `.github/workflows/deploy.yml` was bumped to the
  current Node-24 majors: `actions/checkout@v6`, `actions/setup-node@v6`,
  `actions/upload-pages-artifact@v5`, `actions/deploy-pages@v5` (versions confirmed
  via the GitHub releases API rather than guessed). The next run completed green with
  **no annotations** — warning silenced.

End state on the live site: methodology v0.2.0, light-teal (`#cfecec`) background,
and a warning-free Node-24 CI pipeline.
