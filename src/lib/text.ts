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
}

/**
 * Split one paragraph into render segments given the highlight ranges and the
 * active-word range that intersect it. Offsets are chapter-relative.
 */
export function segmentParagraph(
  para: string,
  paraStart: number,
  highlights: { id: string; startOffset: number; endOffset: number }[],
  activeRange: { start: number; end: number } | null,
): Segment[] {
  const paraEnd = paraStart + para.length;
  // Collect boundary points within this paragraph
  const cuts = new Set<number>([paraStart, paraEnd]);
  for (const h of highlights) {
    cuts.add(Math.max(paraStart, Math.min(paraEnd, h.startOffset)));
    cuts.add(Math.max(paraStart, Math.min(paraEnd, h.endOffset)));
  }
  if (activeRange) {
    cuts.add(Math.max(paraStart, Math.min(paraEnd, activeRange.start)));
    cuts.add(Math.max(paraStart, Math.min(paraEnd, activeRange.end)));
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
    });
  }
  return segments;
}
