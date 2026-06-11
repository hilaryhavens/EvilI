import { describe, it, expect } from 'vitest';
import { createDictionary } from '../../src/engine/dictionary';

describe('dictionary', () => {
  const dict = createDictionary();
  it('knows ordinary English words', () => {
    expect(dict.isKnown('desire')).toBe(true);
    expect(dict.isKnown('she')).toBe(true);
  });
  it('knows period variant spellings so they are never "corrected"', () => {
    expect(dict.isKnown('chuse')).toBe(true);
    expect(dict.isKnown('shew')).toBe(true);
    expect(dict.isKnown('surprize')).toBe(true);
  });
  it('does not know OCR garbage', () => {
    expect(dict.isKnown('fhe')).toBe(false);
    expect(dict.isKnown('paffion')).toBe(false);
  });
  it('is case-insensitive', () => {
    expect(dict.isKnown('Desire')).toBe(true);
  });
  it('maps period variants to modern forms via variantOf', () => {
    expect(dict.variantOf('chuse')).toBe('choose');
    expect(dict.variantOf('Shew')).toBe('show');
    expect(dict.variantOf('desire')).toBeUndefined();
  });
});
