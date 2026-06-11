export interface Segment { label: string; text: string; charStart: number }

const HEADING_RE = /^[ \t]*(?:CHAP(?:TER|\.)?|LETTER|PART|BOOK|VOL(?:UME|\.)?)[ \t]+[\w.]+.*$/gim;

export function segmentText(text: string): Segment[] {
  HEADING_RE.lastIndex = 0;
  const headings: { index: number; label: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = HEADING_RE.exec(text)) !== null) {
    headings.push({ index: m.index, label: m[0].trim() });
  }
  if (headings.length >= 2) {
    return headings.map((h, i) => {
      const end = i + 1 < headings.length ? headings[i + 1].index : text.length;
      return { label: h.label, text: text.slice(h.index, end), charStart: h.index };
    });
  }
  // fallback: fixed-size ~2000-word segments
  const words = [...text.matchAll(/\S+/g)];
  if (words.length === 0) return [{ label: 'Segment 1', text, charStart: 0 }];
  const segs: Segment[] = [];
  for (let i = 0; i < words.length; i += 2000) {
    const start = words[i].index!;
    const endWord = words[Math.min(i + 2000, words.length) - 1];
    const end = endWord.index! + endWord[0].length;
    segs.push({
      label: `Segment ${segs.length + 1}`,
      text: text.slice(start, end),
      charStart: start,
    });
  }
  return segs;
}

export function maskDialogue(text: string): string {
  // mask double-quoted spans (incl. typographic quotes already normalized to ")
  return text.replace(/"[^"\n]{1,600}"/g, (q) => ' '.repeat(q.length));
}
