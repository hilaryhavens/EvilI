// tests/engine/attribution.test.ts
import { describe, it, expect } from 'vitest';
import { extractEvidence } from '../../src/engine/attribution';
import { loadLexicons } from '../../src/engine/lexicons';

const lex = loadLexicons();
const sig = (text: string) => extractEvidence(text, lex).map(h => h.signal + ':' + h.term);

describe('deed attribution', () => {
  it('counts first-person vice deeds', () => {
    expect(sig('I stole the watch from the gentleman.')).toContain('viceDeed:steal');
  });
  it('does not count third-person deeds', () => {
    expect(sig('He stole the watch from the gentleman.')).not.toContain('viceDeed:steal');
  });
  it('does not count negated first-person deeds', () => {
    expect(sig('I never stole anything in my life.')).not.toContain('viceDeed:steal');
  });
  it('counts first-person virtue deeds', () => {
    expect(sig('I repented of my wickedness with many tears.')).toContain('virtueDeed:repent');
  });
});

describe('self-presentation', () => {
  it('catches virtue terms applied to the self', () => {
    expect(sig('I was ever an honest woman, whatever they said.')).toContain('selfVirtue:honest self');
  });
  it('catches vice terms applied to the self', () => {
    expect(sig('What a wicked creature I had become.')).toContain('selfVice:wicked self');
  });
  it('ignores moral terms applied to others', () => {
    expect(sig('She was an honest woman all her days.')).not.toContain('selfVirtue:honest self');
  });
});

describe('phrase signals', () => {
  it('finds hedging phrases', () => {
    expect(sig('I know not how it came to pass.')).toContain('hedging:i know not');
  });
  it('finds justification phrases', () => {
    expect(sig('I was driven by necessity to do what I did; let the reader judge.'))
      .toEqual(expect.arrayContaining(['justification:driven by necessity', 'justification:the reader must']));
  });
  it('finds retraction phrases', () => {
    expect(sig('I told him I was a gentlewoman of fortune; but in truth I had nothing.'))
      .toContain('retraction:but in truth');
  });
});

describe('contradiction (negation reversal)', () => {
  it('flags assert-then-negate on the same first-person verb', () => {
    const text = 'I loved him with all my heart. Years passed in that house. In truth I never loved him at all.';
    expect(sig(text).some(s => s.startsWith('contradiction:'))).toBe(true);
  });
});

describe('dialogue exclusion', () => {
  it('ignores deeds inside quoted dialogue', () => {
    expect(sig('She turned to me and said, "I stole the watch myself."'))
      .not.toContain('viceDeed:steal');
  });
});
