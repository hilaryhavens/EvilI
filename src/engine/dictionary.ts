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
