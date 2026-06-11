import { describe, it, expect } from 'vitest';
import { normalizeTypography, normalizeSpelling } from '../../src/engine/normalize';
import { createDictionary } from '../../src/engine/dictionary';

const dict = createDictionary();

describe('normalizeTypography', () => {
  it('converts long s and ligatures', () => {
    expect(normalizeTypography('paſſion and aﬄiction, ﬁre')).toBe('passion and affliction, fire');
  });
  it('expands &c.', () => {
    expect(normalizeTypography('books, papers, &c.')).toBe('books, papers, etc.');
  });
});

describe('normalizeSpelling', () => {
  it('maps period variants to modern forms', () => {
    expect(normalizeSpelling('I shall chuse to shew it', dict)).toBe('I shall choose to show it');
  });
  it('expands elided preterites when the result is a known word', () => {
    expect(normalizeSpelling("I walk'd and was deceiv'd", dict)).toBe('I walked and was deceived');
  });
  it('handles y-stem preterites', () => {
    expect(normalizeSpelling("she cry'd aloud", dict)).toBe('she cried aloud');
  });
  it('repairs u/v and i/j interchange for unknown words only', () => {
    expect(normalizeSpelling('vpon my ioy', dict)).toBe('upon my joy');
    expect(normalizeSpelling('have over', dict)).toBe('have over'); // known words untouched
  });
});
