// tests/corpus-validation.test.ts
//
// Answer-key validation (methodology v0.2.0). Recorded scores after recalibration:
//   (fill in achieved indices here once Task 3 passes)
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { analyze } from '../src/engine/engine';

const corpus = (f: string) => `corpus/${f}`;
const fixture = (f: string) => `tests/fixtures/letters/${f}`;

// The eight single-narrator corpus texts that must score unreliable (< 40).
// Clarissa.txt and Lady_Susan.txt as WHOLE files are intentionally excluded.
const UNRELIABLE_TEXTS = [
  'Caleb_Williams.txt', 'Castle_Rackrent.txt', 'Lolita.txt',
  'Love_and_Freindship.txt', 'Moll_Flanders.txt', 'Roxana.txt',
  'The_Good_Soldier.txt', 'Tristram_Shandy.txt',
];

const filesPresent =
  UNRELIABLE_TEXTS.every((f) => existsSync(corpus(f))) &&
  ['lovelace.txt', 'clarissa-harlowe.txt', 'lady-susan.txt'].every((f) => existsSync(fixture(f)));

const indexOf = (p: string, title: string) =>
  analyze(readFileSync(p, 'utf-8'), title).reliability!.index;

describe.skipIf(!filesPresent)('answer-key validation', () => {
  it.each(UNRELIABLE_TEXTS)('%s scores unreliable (< 40)', (f) => {
    expect(indexOf(corpus(f), f)).toBeLessThan(40);
  });

  it('Lovelace letters score unreliable (< 40)', () => {
    expect(indexOf(fixture('lovelace.txt'), 'Lovelace')).toBeLessThan(40);
  });

  it('Lady Susan letters score unreliable (< 40)', () => {
    expect(indexOf(fixture('lady-susan.txt'), 'Lady Susan')).toBeLessThan(40);
  });

  it('Clarissa Harlowe letters stay reliable (>= 60) — the control', () => {
    expect(indexOf(fixture('clarissa-harlowe.txt'), 'Clarissa')).toBeGreaterThanOrEqual(60);
  });
}, 600_000);
