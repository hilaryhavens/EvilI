import { describe, it, expect } from 'vitest';
import { segmentText, maskDialogue } from '../../src/engine/segment';

describe('segmentText', () => {
  it('splits on chapter and letter headings', () => {
    const text = 'CHAPTER I\nFirst part here.\nCHAPTER II\nSecond part here.';
    const segs = segmentText(text);
    expect(segs).toHaveLength(2);
    expect(segs[0].label).toBe('CHAPTER I');
    expect(segs[1].text).toContain('Second part');
    expect(segs[1].charStart).toBe(text.indexOf('CHAPTER II'));
  });
  it('falls back to ~2000-word segments when no headings exist', () => {
    const text = Array(4500).fill('word').join(' ');
    const segs = segmentText(text);
    expect(segs.length).toBe(3);
    expect(segs[0].label).toBe('Segment 1');
  });
});

describe('maskDialogue', () => {
  it('replaces quoted spans with spaces, preserving length and offsets', () => {
    const text = 'He said, "I am innocent," and left.';
    const masked = maskDialogue(text);
    expect(masked.length).toBe(text.length);
    expect(masked).not.toContain('innocent');
    expect(masked.slice(0, 8)).toBe('He said,');
  });
});
