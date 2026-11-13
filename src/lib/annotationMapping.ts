import type { Book, Highlight } from '../data/types';
import { currentChapterIndex } from './bookMapping';

/** Never apply a saved offset unless the text at that location still agrees. */
export function relocateHighlight(highlight: Highlight, book: Book, plainChapters: string[]): Highlight {
  const chapterIndex = currentChapterIndex(book, highlight.chapterIndex);
  const plain = plainChapters[chapterIndex] ?? '';
  if (highlight.textRevision && highlight.textRevision === book.textRevision && highlight.text && plain.slice(highlight.startOffset, highlight.endOffset) === highlight.text)
    return { ...highlight, chapterIndex, unresolved: false };
  let found: { chapterIndex: number; startOffset: number; endOffset: number } | undefined;
  if (highlight.text) for (let i = 0; i < plainChapters.length; i++) {
    let from = 0;
    for (;;) {
      const start = plainChapters[i].indexOf(highlight.text, from);
      if (start < 0) break;
      // A repeated excerpt is ambiguous; preserve the note rather than guessing.
      if (found) return { ...highlight, chapterIndex, unresolved: true };
      found = { chapterIndex: i, startOffset: start, endOffset: start + highlight.text.length };
      from = start + 1;
    }
  }
  return found ? { ...highlight, ...found, unresolved: false } : { ...highlight, chapterIndex, unresolved: true };
}
