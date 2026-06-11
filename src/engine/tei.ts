export function stripTei(input: string): string {
  if (!/^\s*</.test(input)) return input; // plain text
  let s = input;
  const bodyMatch = /<text[\s>][\s\S]*?<\/text>/i.exec(s);
  if (bodyMatch) s = bodyMatch[0];
  s = s.replace(/<teiHeader[\s\S]*?<\/teiHeader>/gi, '');
  s = s.replace(/<\/(p|div|lg|l|head)>/gi, '\n\n');   // block ends -> paragraph breaks
  s = s.replace(/<[^>]+>/g, '');
  s = s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));
  return s.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}
