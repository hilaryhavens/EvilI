import { describe, it, expect } from 'vitest';
import { detectPerspective } from '../../src/engine/judgment1';

const FP = `I was born in the year 1632. I had two elder brothers and my father
designed me for the law; but I would be satisfied with nothing but going to sea.
My mind was filled with rambling thoughts, and I resolved upon my voyage.`;

const TP = `She was born in the year 1632. She had two elder brothers and her father
designed her for the law; but she would be satisfied with nothing but the town.
Her mind was filled with rambling thoughts, and he resolved against her wishes.`;

describe('detectPerspective', () => {
  it('detects first-person narration', () => {
    const r = detectPerspective(FP);
    expect(r.verdict).toBe('first-person');
    expect(r.confidence).toBeGreaterThan(0.5);
  });
  it('detects third-person narration', () => {
    expect(detectPerspective(TP).verdict).toBe('third-person');
  });
  it('ignores first-person pronouns inside dialogue', () => {
    const tpWithDialogue = TP + ' "I am sure I shall never consent," said she. "I will not."';
    expect(detectPerspective(tpWithDialogue).verdict).toBe('third-person');
  });
  it('flags heavy second-person address as mixed-epistolary', () => {
    const epistolary = `Dear Madam, you will wonder that I write to you so soon.
    Thou knowest, dear friend, what thou hast asked of me, and you shall hear all.
    You must know that you are ever in my thoughts, as thou art in my prayers.`;
    expect(detectPerspective(epistolary).verdict).toBe('mixed-epistolary');
  });
});
