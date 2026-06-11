import { describe, it, expect } from 'vitest';
import { remediateOcr } from '../../src/engine/ocr';
import { createDictionary } from '../../src/engine/dictionary';

const dict = createDictionary();

describe('remediateOcr', () => {
  it('repairs long-s-as-f misreads when the original is not a word', () => {
    const { text } = remediateOcr('fhe had fome fuch defire', dict);
    expect(text).toBe('she had some such desire');
  });
  it('leaves ambiguous real-word pairs alone', () => {
    const { text, report } = remediateOcr('his fame was the same', dict);
    expect(text).toBe('his fame was the same');
    expect(report.corrections).toHaveLength(0);
  });
  it('rejoins hyphenated line-break splits', () => {
    const { text } = remediateOcr('she con-\ntinued her story', dict);
    expect(text).toBe('she continued her story');
  });
  it('logs corrections with original and corrected forms', () => {
    const { report } = remediateOcr('fhe spoke', dict);
    expect(report.corrections[0]).toMatchObject({ original: 'fhe', corrected: 'she' });
  });
  it('computes unknown token rate and recognized word count', () => {
    const { report } = remediateOcr('she had qzxv strange words', dict);
    expect(report.recognizedWordCount).toBe(4);
    expect(report.unknownTokenRate).toBeCloseTo(1 / 5);
  });
});
