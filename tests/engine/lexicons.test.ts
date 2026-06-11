import { describe, it, expect } from 'vitest';
import { loadLexicons } from '../../src/engine/lexicons';

describe('loadLexicons', () => {
  const lex = loadLexicons();
  it('loads all six categories', () => {
    for (const k of ['vice', 'virtue', 'selfPresentation', 'hedging', 'justification', 'retraction'] as const) {
      // >= 10: the retraction seed lexicon intentionally has exactly 10 entries
      expect(lex[k].entries.length).toBeGreaterThanOrEqual(10);
    }
  });
  it('every entry has term, forms, and positive weight', () => {
    for (const cat of Object.values(lex)) {
      for (const e of cat.entries) {
        expect(e.term.length).toBeGreaterThan(0);
        expect(e.forms.length).toBeGreaterThan(0);
        expect(e.weight).toBeGreaterThan(0);
      }
    }
  });
  it('builds a form lookup map', () => {
    expect(lex.vice.formIndex.get('stole')?.term).toBe('steal');
  });
});
