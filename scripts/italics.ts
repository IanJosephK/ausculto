/**
 * Project Gutenberg plain text marks italics by wrapping runs in underscores:
 * "so _very_ remarkable", "_To Mrs. Saville, England._". We don't want those
 * underscores in the stored text — they'd corrupt word tokenization, search,
 * and quote cards — so we strip them and record the italic spans separately as
 * character ranges into the *clean* text. The renderer re-applies them as <em>.
 */
export function parseItalics(raw: string): { text: string; italics: [number, number][] } {
  const italics: [number, number][] = [];
  let text = '';
  let lastIndex = 0;
  // A balanced _..._ pair with non-underscore content. Unpaired lone
  // underscores fall through and are preserved as literal characters.
  const re = /_([^_]+)_/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    text += raw.slice(lastIndex, m.index);
    const start = text.length;
    text += m[1];
    italics.push([start, text.length]);
    lastIndex = re.lastIndex;
  }
  text += raw.slice(lastIndex);
  return { text, italics };
}
