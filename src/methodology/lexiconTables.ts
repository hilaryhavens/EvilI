// src/methodology/lexiconTables.ts
// Renders lexicon entry tables for methodology.html — single source of truth.
import vice from '../lexicons/vice.json';
import virtue from '../lexicons/virtue.json';
import selfPresentation from '../lexicons/selfPresentation.json';
import hedging from '../lexicons/hedging.json';
import justification from '../lexicons/justification.json';
import retraction from '../lexicons/retraction.json';

interface LexEntry {
  term: string;
  forms: string[];
  weight: number;
  polarity?: number;
  kind?: string;
}

interface Lexicon {
  category: string;
  entries: LexEntry[];
}

function buildTable(lex: Lexicon): string {
  const hasPolarity = lex.entries.some((e) => e.polarity !== undefined);
  const rows = lex.entries
    .map(
      (e) =>
        `<tr><td>${e.term}</td><td>${e.forms.join(', ')}</td><td>${e.weight}</td>${
          hasPolarity ? `<td>${e.polarity === 1 ? '+' : e.polarity === -1 ? '−' : '0'}</td>` : ''
        }</tr>`,
    )
    .join('');
  return `<h3 id="lex-${lex.category}">${lex.category} (${lex.entries.length} entries)</h3>
<table class="lex-table">
  <thead><tr><th>term</th><th>forms</th><th>weight</th>${hasPolarity ? '<th>polarity</th>' : ''}</tr></thead>
  <tbody>${rows}</tbody>
</table>`;
}

const root = document.getElementById('lexicon-tables');
if (root) {
  const lexicons: Lexicon[] = [vice, virtue, selfPresentation, hedging, justification, retraction];
  for (const lex of lexicons) {
    root.insertAdjacentHTML('beforeend', buildTable(lex));
  }
}
