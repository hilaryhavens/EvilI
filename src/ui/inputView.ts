// src/ui/inputView.ts
export interface TextInput { title: string; text: string }

export function renderInputView(
  root: HTMLElement,
  onAnalyze: (texts: TextInput[]) => void,
): void {
  root.innerHTML = `
    <section class="input-view">
      <h1>EvilI</h1>
      <p class="tagline">Detecting unreliable first-person narrators in
        eighteenth-century British texts. Analysis runs entirely in your browser
        &mdash; nothing you paste or upload ever leaves this page.
        <a href="methodology.html">How it works</a></p>
      <textarea id="paste-box" rows="10"
        placeholder="Paste a passage or a whole novel here&hellip;"></textarea>
      <div class="upload-zone">
        <label>Or upload .txt / TEI-XML files (several at once for comparison):
          <input type="file" id="file-input" multiple accept=".txt,.xml" />
        </label>
      </div>
      <div id="corpus-shelf" class="corpus-shelf"><h2>Or try a sample</h2></div>
      <button id="analyze-btn">Analyze</button>
      <p class="error" id="input-error" hidden></p>
    </section>`;

  const files: TextInput[] = [];
  const fileInput = root.querySelector<HTMLInputElement>('#file-input')!;
  fileInput.addEventListener('change', async () => {
    files.length = 0;
    for (const f of fileInput.files ?? []) {
      files.push({ title: f.name.replace(/\.(txt|xml)$/i, ''), text: await f.text() });
    }
  });

  loadCorpusShelf(root.querySelector('#corpus-shelf')!, onAnalyze);

  root.querySelector('#analyze-btn')!.addEventListener('click', () => {
    const pasted = root.querySelector<HTMLTextAreaElement>('#paste-box')!.value.trim();
    const texts: TextInput[] = [...files];
    if (pasted) texts.unshift({ title: 'Pasted text', text: pasted });
    const errEl = root.querySelector<HTMLElement>('#input-error')!;
    if (texts.length === 0) {
      errEl.textContent = 'Paste some text or choose a file first.';
      errEl.hidden = false;
      return;
    }
    errEl.hidden = true;
    onAnalyze(texts);
  });
}

interface CorpusItem { title: string; author: string; year: string; hook: string; file: string }

async function loadCorpusShelf(shelf: HTMLElement, onAnalyze: (t: TextInput[]) => void) {
  try {
    const base = import.meta.env.BASE_URL;
    const items: CorpusItem[] = await (await fetch(`${base}corpus/corpus.json`)).json();
    for (const item of items) {
      const card = document.createElement('button');
      card.className = 'corpus-card';
      card.innerHTML = `<strong>${item.title}</strong><br>${item.author}, ${item.year}<br><em>${item.hook}</em>`;
      card.addEventListener('click', async () => {
        const text = await (await fetch(`${base}corpus/${item.file}`)).text();
        onAnalyze([{ title: item.title, text }]);
      });
      shelf.appendChild(card);
    }
  } catch { /* corpus optional in dev */ }
}
