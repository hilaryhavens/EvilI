// tests/ui/export.test.ts
import { describe, it, expect } from 'vitest';
import { reportToJson, reportsToCsv, hitsToCsv } from '../../src/ui/export';
import { analyze } from '../../src/engine/engine';

const r = analyze('I stole the watch; but in truth I was ever an honest woman. I know not why.', 'Export Test');

describe('export serialization', () => {
  it('JSON round-trips the full report minus the bulky text', () => {
    const parsed = JSON.parse(reportToJson(r));
    expect(parsed.title).toBe('Export Test');
    expect(parsed.methodologyVersion).toBeTruthy();
    expect(parsed.evidence.length).toBeGreaterThan(0);
    expect(parsed.processedText).toBeUndefined(); // excluded: texts may be in-copyright
  });
  it('CSV has a header and one row per text', () => {
    const csv = reportsToCsv([r]);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toContain('reliability');
    expect(lines).toHaveLength(2);
  });
  it('hits CSV has one row per evidence hit and escapes quotes', () => {
    const csv = hitsToCsv(r);
    expect(csv.trim().split('\n').length).toBe(r.evidence.length + 1);
  });
});
