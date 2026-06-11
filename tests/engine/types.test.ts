import { describe, it, expect } from 'vitest';
import { moralBand, clamp } from '../../src/engine/types';

describe('moralBand', () => {
  it('maps scores to the five labeled bands', () => {
    expect(moralBand(80)).toBe('virtuous');
    expect(moralBand(40)).toBe('mostly virtuous');
    expect(moralBand(0)).toBe('ambiguous');
    expect(moralBand(-40)).toBe('questionable');
    expect(moralBand(-80)).toBe('immoral');
  });
});

describe('clamp', () => {
  it('clamps to range', () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-5, 0, 100)).toBe(0);
    expect(clamp(42, 0, 100)).toBe(42);
  });
});
