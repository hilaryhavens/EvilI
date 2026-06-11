import { describe, it, expect } from 'vitest';
import { stripTei } from '../../src/engine/tei';

describe('stripTei', () => {
  it('extracts text content from the <text> body, dropping the header', () => {
    const xml = `<TEI><teiHeader><title>Meta</title></teiHeader>
      <text><body><p>I was born in Newgate.</p><p>My mother was convicted.</p></body></text></TEI>`;
    expect(stripTei(xml)).toBe('I was born in Newgate.\n\nMy mother was convicted.');
  });
  it('decodes common entities', () => {
    const xml = `<text><p>Tom &amp; Moll &#8212; thieves</p></text>`;
    expect(stripTei(xml)).toContain('Tom & Moll');
  });
  it('passes plain text through unchanged', () => {
    expect(stripTei('Just plain prose.')).toBe('Just plain prose.');
  });
});
