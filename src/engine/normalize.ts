import type { Dictionary } from './dictionary';

export function normalizeTypography(text: string): string {
  return text
    .replace(/ſ/g, 's')
    .replace(/ﬁ/g, 'fi').replace(/ﬂ/g, 'fl').replace(/ﬀ/g, 'ff')
    .replace(/ﬃ/g, 'ffi').replace(/ﬄ/g, 'ffl').replace(/ﬆ/g, 'st')
    .replace(/&c\./g, 'etc.')
    .replace(/['']/g, "'").replace(/[""]/g, '"');
}

const WORD_RE = /[A-Za-z]+(?:'[A-Za-z]+)?/g;

export function normalizeSpelling(text: string, dict: Dictionary): string {
  return text.replace(WORD_RE, (w) => {
    const variant = dict.variantOf(w);
    if (variant) return matchCase(w, variant);
    const m = /^([A-Za-z]+)'d$/.exec(w);
    if (m) {
      const stem = m[1];
      for (const cand of [stem + 'ed', stem.replace(/y$/, 'i') + 'ed']) {
        if (dict.isKnown(cand)) return matchCase(w, cand);
      }
      return w;
    }
    if (!dict.isKnown(w)) {
      for (const cand of uvijCandidates(w)) {
        if (dict.isKnown(cand)) return matchCase(w, cand);
      }
    }
    return w;
  });
}

function uvijCandidates(w: string): string[] {
  const lower = w.toLowerCase();
  return [
    lower.replace(/^v/, 'u'),               // vpon -> upon
    lower.replace(/(?<=\w)u(?=\w)/g, 'v'),  // loue -> love
    lower.replace(/^i/, 'j'),               // ioy -> joy
    lower.replace(/^j/, 'i'),
  ];
}

function matchCase(original: string, replacement: string): string {
  if (original[0] === original[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}
