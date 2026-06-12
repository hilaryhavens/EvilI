// scripts/extract-letters.mjs
// Splits the epistolary corpus novels into single-author fixtures.
// Usage: node scripts/extract-letters.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'tests', 'fixtures', 'letters');
mkdirSync(outDir, { recursive: true });

const MIN_CHARS = 20_000;

// Split `text` into letters at lines matching `headerRe`. Return array of
// { sender: <full header line>, body: <header + following lines> }.
function splitLetters(text, headerRe) {
  const lines = text.split(/\r?\n/);
  const starts = [];
  for (let i = 0; i < lines.length; i++) {
    if (headerRe.test(lines[i])) starts.push(i);
  }
  const letters = [];
  for (let k = 0; k < starts.length; k++) {
    const from = starts[k];
    const to = k + 1 < starts.length ? starts[k + 1] : lines.length;
    letters.push({ sender: lines[from], body: lines.slice(from, to).join('\n') });
  }
  return letters;
}

function collect(text, headerRe, classify, label) {
  const all = splitLetters(text, headerRe);
  const chosen = all.filter((l) => classify(l.sender));
  const out = chosen.map((l) => l.body).join('\n\n');
  if (chosen.length === 0) {
    throw new Error(`extract-letters: zero letters matched for ${label}`);
  }
  if (out.length < MIN_CHARS) {
    throw new Error(`extract-letters: ${label} only ${out.length} chars (< ${MIN_CHARS})`);
  }
  console.log(`${label}: ${chosen.length} letters, ${out.length} chars`);
  return out;
}

// --- Clarissa: any all-caps "NAME, TO NAME" header line ---
const clarissaText = readFileSync(join(root, 'corpus', 'Clarissa.txt'), 'utf-8');
const clarissaHeader = /^[A-Z][A-Z.\- ]+,\s+TO\s+[A-Z]/;
writeFileSync(
  join(outDir, 'lovelace.txt'),
  collect(clarissaText, clarissaHeader,
    (s) => /^(MR\.|MRS\.)?\s*LOVELACE,\s+TO\b/.test(s), 'lovelace'),
);
writeFileSync(
  join(outDir, 'clarissa-harlowe.txt'),
  collect(clarissaText, clarissaHeader,
    (s) => /^MISS CLARISSA HARLOWE,\s+TO\b/.test(s), 'clarissa-harlowe'),
);

// --- Lady Susan: mixed-case "Lady Susan ... to <recipient>." header ---
const ladySusanText = readFileSync(join(root, 'corpus', 'Lady_Susan.txt'), 'utf-8');
const ladySusanHeader = /^[A-Z][a-zA-Z. ]+\sto\s+(Mr|Mrs|Miss|Lady|the)\b/;
writeFileSync(
  join(outDir, 'lady-susan.txt'),
  collect(ladySusanText, ladySusanHeader,
    (s) => /^Lady Susan\b.*\bto\b/.test(s), 'lady-susan'),
);

console.log('done');
