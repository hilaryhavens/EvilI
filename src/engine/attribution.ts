import { type ItemSentence, type ItemToken } from 'wink-nlp';
import { getNlp } from './nlp';
import { maskDialogue } from './segment';
import { loadLexicons, type Lexicons } from './lexicons';
import type { EvidenceHit, Signal } from './types';

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

  // for contradiction detection: lowercased surface form -> affirm/negate info
  const verbPolarity = new Map<string, { affirmed?: string; negated?: string }>();

  doc.sentences().each((sentence: ItemSentence) => {
    const sentText = sentence.out() as string;

    // Build token list with char offsets, POS, negation flag
    interface TokenInfo {
      text: string;      // lowercased
      surface: string;   // original surface
      pos: string;
      negated: boolean;
      charStart: number;
    }
    const tokens: TokenInfo[] = [];

    // Compute the sentence's start offset in the narration string
    // by finding the sentence text in narration (approximate; fine for our use)
    const sentOffset = narration.indexOf(sentText);

    // Walk tokens, accumulating char offsets within the sentence
    let cursor = 0;
    sentence.tokens().each((t: ItemToken) => {
      const surface = t.out() as string;
      const preceding = t.out(its.precedingSpaces) as string;
      cursor += preceding.length;
      const charStart = (sentOffset >= 0 ? sentOffset : 0) + cursor;
      tokens.push({
        text: surface.toLowerCase(),
        surface,
        pos: t.out(its.pos) as string,
        negated: t.out(its.negationFlag) as boolean,
        charStart,
      });
      cursor += surface.length;
    });

    const fpSentence = tokens.some((t) => FP_ANY.has(t.text));

    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i];

      // deeds: vice / virtue — first-person subject required, negation blocks
      for (const [lexName, signal] of [
        ['vice', 'viceDeed'],
        ['virtue', 'virtueDeed'],
      ] as const) {
        const entry = lexicons[lexName].formIndex.get(tok.text);
        if (entry && !tok.negated && hasFirstPersonSubject(tokens, i)) {
          hits.push({
            signal: signal as Signal,
            term: entry.term,
            sentence: sentText.trim(),
            charStart: tok.charStart,
            charEnd: tok.charStart + tok.surface.length,
            segmentIndex: segmentIndexAt(tok.charStart),
            weight: entry.weight,
          });
        }
      }

      // self-presentation: moral adjective/noun in a first-person sentence
      const sp = lexicons.selfPresentation.formIndex.get(tok.text);
      if (sp && fpSentence && !tok.negated) {
        const signal: Signal = sp.polarity === -1 ? 'selfVice' : 'selfVirtue';
        hits.push({
          signal,
          term: sp.term,
          sentence: sentText.trim(),
          charStart: tok.charStart,
          charEnd: tok.charStart + tok.surface.length,
          segmentIndex: segmentIndexAt(tok.charStart),
          weight: sp.weight,
        });
      }

      // contradiction bookkeeping: first-person verbs (track both polarities)
      if (tok.pos === 'VERB' && hasFirstPersonSubject(tokens, i)) {
        const rec = verbPolarity.get(tok.text) ?? {};
        if (tok.negated) {
          rec.negated = sentText;
        } else {
          rec.affirmed = sentText;
        }
        verbPolarity.set(tok.text, rec);
      }
    }
  });

  // phrase signals over lowercased narration
  const lowerNarration = narration.toLowerCase();
  for (const lexName of ['hedging', 'justification', 'retraction'] as const) {
    for (const { form, entry } of lexicons[lexName].phrases) {
      let from = 0;
      let idx: number;
      while ((idx = lowerNarration.indexOf(form, from)) !== -1) {
        hits.push({
          signal: lexName,
          term: entry.term,
          sentence: sentenceAround(processedText, idx),
          charStart: idx,
          charEnd: idx + form.length,
          segmentIndex: segmentIndexAt(idx),
          weight: entry.weight,
        });
        from = idx + form.length;
      }
    }
    // single-word entries (no kind: 'phrase') in these lexicons
    for (const [form, entry] of lexicons[lexName].formIndex) {
      const re = new RegExp(`\\b${escapeRegex(form)}\\b`, 'gi');
      let m: RegExpExecArray | null;
      while ((m = re.exec(narration)) !== null) {
        hits.push({
          signal: lexName,
          term: entry.term,
          sentence: sentenceAround(processedText, m.index),
          charStart: m.index,
          charEnd: m.index + form.length,
          segmentIndex: segmentIndexAt(m.index),
          weight: entry.weight,
        });
      }
    }
  }

  // contradictions: same first-person verb both affirmed and negated
  for (const [verb, rec] of verbPolarity) {
    if (rec.affirmed && rec.negated) {
      const idx = processedText.toLowerCase().indexOf(verb);
      const start = Math.max(idx, 0);
      hits.push({
        signal: 'contradiction',
        term: verb,
        sentence: `Affirmed: "${rec.affirmed.trim()}" — Negated: "${rec.negated.trim()}"`,
        charStart: start,
        charEnd: start + verb.length,
        segmentIndex: segmentIndexAt(start),
        weight: 2,
      });
    }
  }

  return hits.sort((a, b) => a.charStart - b.charStart);
}

function hasFirstPersonSubject(
  tokens: { text: string; pos: string }[],
  i: number,
): boolean {
  // scan backwards up to 8 tokens, stopping at clause boundaries
  for (let j = i - 1; j >= 0 && i - j <= 8; j--) {
    const t = tokens[j];
    if (t.text === ';' || t.text === ':') break;
    if (FP_SUBJECTS.has(t.text)) return true;
    if (t.pos === 'PRON' || t.pos === 'PROPN' || t.pos === 'NOUN') return false;
  }
  return false;
}

function sentenceAround(text: string, offset: number): string {
  const start = Math.max(text.lastIndexOf('.', offset), text.lastIndexOf('\n', offset)) + 1;
  let end = text.indexOf('.', offset);
  if (end === -1) end = Math.min(text.length, offset + 200);
  return text.slice(start, end + 1).trim();
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
