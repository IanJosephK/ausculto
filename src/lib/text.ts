import type { ChapterText } from '../data/types';

/**
 * Character layout of a chapter. All highlight offsets and word-alignment
 * token indices are relative to `plain` — the paragraphs joined with "\n\n".
 */
export interface ChapterLayout {
  plain: string;
  /** Char offset where each paragraph starts in `plain` */
  paragraphStarts: number[];
  /** Char ranges of each whitespace-separated token, in reading order */
  tokens: { start: number; end: number }[];
  /** For each token, which paragraph contains it */
  tokenParagraph: number[];
}

export function layoutChapter(text: ChapterText): ChapterLayout {
  const paragraphStarts: number[] = [];
  const tokens: { start: number; end: number }[] = [];
  const tokenParagraph: number[] = [];
  let offset = 0;
  const parts: string[] = [];

  text.paragraphs.forEach((para, pIdx) => {
    if (pIdx > 0) offset += 2; // '\n\n'
    paragraphStarts.push(offset);
    for (const match of para.matchAll(/\S+/g)) {
      tokens.push({ start: offset + match.index, end: offset + match.index + match[0].length });
      tokenParagraph.push(pIdx);
    }
    parts.push(para);
    offset += para.length;
  });

  return { plain: parts.join('\n\n'), paragraphStarts, tokens, tokenParagraph };
}

export interface Segment {
  text: string;
  /** ids of highlights covering this segment (usually 0 or 1) */
  highlightIds: string[];
  /** true when this segment is the currently spoken word */
  active: boolean;
  /** true when this segment falls inside an italic range */
  italic: boolean;
}

/**
 * Split one paragraph into render segments given the highlight ranges, the
 * active-word range, and the italic ranges that intersect it. All offsets are
 * chapter-relative.
 */
export function segmentParagraph(
  para: string,
  paraStart: number,
  highlights: { id: string; startOffset: number; endOffset: number }[],
  activeRange: { start: number; end: number } | null,
  italicRanges: { start: number; end: number }[] = [],
): Segment[] {
  const paraEnd = paraStart + para.length;
  // Collect boundary points within this paragraph
  const cuts = new Set<number>([paraStart, paraEnd]);
  const addCut = (n: number) => cuts.add(Math.max(paraStart, Math.min(paraEnd, n)));
  for (const h of highlights) {
    addCut(h.startOffset);
    addCut(h.endOffset);
  }
  if (activeRange) {
    addCut(activeRange.start);
    addCut(activeRange.end);
  }
  for (const r of italicRanges) {
    addCut(r.start);
    addCut(r.end);
  }
  const points = [...cuts].sort((a, b) => a - b);

  const segments: Segment[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const start = points[i];
    const end = points[i + 1];
    if (end <= start) continue;
    segments.push({
      text: para.slice(start - paraStart, end - paraStart),
      highlightIds: highlights.filter((h) => h.startOffset < end && h.endOffset > start).map((h) => h.id),
      active: activeRange !== null && activeRange.start < end && activeRange.end > start,
      italic: italicRanges.some((r) => r.start < end && r.end > start),
    });
  }
  return segments;
}
