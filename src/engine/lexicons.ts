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

// Shape as TypeScript infers it from the JSON imports (polarity/kind widen
// to number/string); narrowed to LexiconEntry once, inside build().
interface RawEntry {
  term: string;
  forms: string[];
  weight: number;
  polarity?: number;
  kind?: string;
}

function build(raw: { category: string; entries: RawEntry[] }): Lexicon {
  const entries = raw.entries as LexiconEntry[];
  const formIndex = new Map<string, LexiconEntry>();
  const phrases: Lexicon['phrases'] = [];
  for (const e of entries) {
    for (const f of e.forms) {
      if (e.kind === 'phrase') phrases.push({ form: f, entry: e });
      else formIndex.set(f, e);
    }
  }
  return { category: raw.category, entries, formIndex, phrases };
}

let cached: Lexicons | null = null;
export function loadLexicons(): Lexicons {
  if (!cached) {
    cached = {
      vice: build(vice), virtue: build(virtue),
      selfPresentation: build(selfPresentation),
      hedging: build(hedging), justification: build(justification),
      retraction: build(retraction),
    };
  }
  return cached;
}
