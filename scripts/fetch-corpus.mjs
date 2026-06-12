// scripts/fetch-corpus.mjs — run once with: node scripts/fetch-corpus.mjs
import { writeFile, mkdir } from 'node:fs/promises';

// Gutenberg IDs — VERIFY each at gutenberg.org before relying on it
// (search the title; IDs below are best-known candidates).
const CORPUS = [
  { id: 370,   file: 'moll-flanders.txt', title: 'Moll Flanders', author: 'Daniel Defoe', year: '1722', hook: "Defoe's repentant thief tells her own story" },
  { id: 376,   file: 'plague-year.txt',   title: 'A Journal of the Plague Year', author: 'Daniel Defoe', year: '1722', hook: 'An eyewitness account of the 1665 plague' },
  { id: 829,   file: 'gulliver.txt',      title: "Gulliver's Travels", author: 'Jonathan Swift', year: '1726', hook: 'A ship\'s surgeon among giants, midgets, and horses' },
  { id: 6124,  file: 'pamela.txt',        title: 'Pamela', author: 'Samuel Richardson', year: '1740', hook: 'Virtue rewarded — or is it? — in letters' },
  { id: 30344, file: 'roxana.txt',        title: 'Roxana', author: 'Daniel Defoe', year: '1724', hook: 'The fortunate mistress counts the cost of her rise' },
];

await mkdir('public/corpus', { recursive: true });
const manifest = [];
for (const { id, file, ...meta } of CORPUS) {
  const url = `https://www.gutenberg.org/files/${id}/${id}-0.txt`;
  console.log(`fetching ${meta.title} from ${url}`);
  const res = await fetch(url);
  if (!res.ok) { console.error(`SKIP ${meta.title}: HTTP ${res.status} — verify the ID`); continue; }
  let text = await res.text();
  // strip Gutenberg boilerplate
  const start = text.search(/\*\*\* ?START OF.*\*\*\*/);
  const end = text.search(/\*\*\* ?END OF.*\*\*\*/);
  if (start !== -1 && end !== -1) text = text.slice(text.indexOf('\n', start), end);
  await writeFile(`public/corpus/${file}`, text.trim());
  manifest.push({ ...meta, file });
}
await writeFile('public/corpus/corpus.json', JSON.stringify(manifest, null, 2));
console.log(`wrote ${manifest.length} texts + manifest`);
