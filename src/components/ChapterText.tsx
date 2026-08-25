import { Fragment, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { ChapterText as ChapterTextData, Highlight } from '../data/types';
import { segmentParagraph, type ChapterLayout } from '../lib/text';

export interface SelectionInfo {
  start: number;
  end: number;
  text: string;
  /** Anchor for the popover, relative to the text container */
  x: number;
  y: number;
}

interface ChapterTextProps {
  text: ChapterTextData | null;
  layout: ChapterLayout | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  highlights: Highlight[];
  /** Char range of the word currently being spoken (word-level sync) */
  activeRange: { start: number; end: number } | null;
  /** Paragraph containing the active word */
  activeParagraph: number | null;
  onSelect: (sel: SelectionInfo) => void;
  onHighlightClick: (id: string, x: number, y: number) => void;
  /** Paragraph to scroll to (search result / saved highlight) */
  scrollTarget: number | null;
  onScrolledToTarget: () => void;
  /** Popover etc. positioned against this container */
  children?: ReactNode;
}

const NO_HIGHLIGHTS: Highlight[] = [];
const NO_ITALICS: [number, number][] = [];

const Paragraph = memo(function Paragraph({
  para,
  paraStart,
  pIdx,
  highlights,
  activeRange,
  italics,
  registerRef,
  flash,
}: {
  para: string;
  paraStart: number;
  pIdx: number;
  highlights: Highlight[];
  activeRange: { start: number; end: number } | null;
  italics: [number, number][];
  registerRef: (idx: number, el: HTMLParagraphElement | null) => void;
  flash: boolean;
}) {
  const segments = useMemo(() => {
    const italicRanges = italics.map(([s, e]) => ({ start: paraStart + s, end: paraStart + e }));
    return segmentParagraph(para, paraStart, highlights, activeRange, italicRanges);
  }, [para, paraStart, highlights, activeRange, italics]);
  return (
    <p
      ref={(el) => registerRef(pIdx, el)}
      data-pidx={pIdx}
      data-start={paraStart}
      className={flash ? 'flash-target' : undefined}
    >
      {segments.map((seg, i) => {
        const content = seg.italic ? <em>{seg.text}</em> : seg.text;
        if (seg.active) {
          return (
            <span key={i} className="active-word">
              {content}
            </span>
          );
        }
        if (seg.highlightIds.length > 0) {
          return (
            <span key={i} className="hl" data-hid={seg.highlightIds[0]} role="button" tabIndex={0}>
              {content}
            </span>
          );
        }
        return <Fragment key={i}>{content}</Fragment>;
      })}
    </p>
  );
});

export function ChapterText({
  text,
  layout,
  loading,
  error,
  onRetry,
  highlights,
  activeRange,
  activeParagraph,
  onSelect,
  onHighlightClick,
  scrollTarget,
  onScrolledToTarget,
  children,
}: ChapterTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const paraRefs = useRef(new Map<number, HTMLParagraphElement>());
  const lastUserScrollRef = useRef(0);
  const [flashPara, setFlashPara] = useState<number | null>(null);

  const registerRef = useCallback((idx: number, el: HTMLParagraphElement | null) => {
    if (el) paraRefs.current.set(idx, el);
    else paraRefs.current.delete(idx);
  }, []);

  // Highlights bucketed per paragraph, referentially stable across renders
  const highlightsByPara = useMemo(() => {
    const map = new Map<number, Highlight[]>();
    if (!layout) return map;
    for (const h of highlights) {
      for (let p = 0; p < layout.paragraphStarts.length; p++) {
        const pStart = layout.paragraphStarts[p];
        const pEnd = pStart + (text?.paragraphs[p]?.length ?? 0);
        if (h.startOffset < pEnd && h.endOffset > pStart) {
          const arr = map.get(p) ?? [];
          arr.push(h);
          map.set(p, arr);
        }
      }
    }
    return map;
  }, [highlights, layout, text]);

  // Pause auto-scroll for a few seconds after the user scrolls themselves
  useEffect(() => {
    const markScroll = () => {
      lastUserScrollRef.current = Date.now();
    };
    window.addEventListener('wheel', markScroll, { passive: true });
    window.addEventListener('touchmove', markScroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', markScroll);
      window.removeEventListener('touchmove', markScroll);
    };
  }, []);

  // Keep the spoken word in view
  useEffect(() => {
    if (activeParagraph === null) return;
    if (Date.now() - lastUserScrollRef.current < 4000) return;
    paraRefs.current.get(activeParagraph)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [activeParagraph]);

  // Jump to a search result / saved annotation
  useEffect(() => {
    if (scrollTarget === null || !text) return;
    const el = paraRefs.current.get(scrollTarget);
    if (!el) return;
    el.scrollIntoView({ block: 'center' });
    setFlashPara(scrollTarget);
    const t = setTimeout(() => setFlashPara(null), 2100);
    onScrolledToTarget();
    return () => clearTimeout(t);
  }, [scrollTarget, text, onScrolledToTarget]);

  const closestParagraph = (node: Node): HTMLElement | null => {
    const el = node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement);
    const p = el?.closest<HTMLElement>('p[data-start]') ?? null;
    return p && containerRef.current?.contains(p) ? p : null;
  };

  const prefixLength = (p: HTMLElement, node: Node, offset: number): number => {
    const r = document.createRange();
    r.setStart(p, 0);
    r.setEnd(node, offset);
    return r.toString().length;
  };

  const handlePointerUp = () => {
    // Let the browser finalize the selection first
    setTimeout(() => {
      if (!layout || !containerRef.current) return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      const startP = closestParagraph(range.startContainer);
      const endP = closestParagraph(range.endContainer);
      if (!startP || !endP) return;
      const start = Number(startP.dataset.start) + prefixLength(startP, range.startContainer, range.startOffset);
      const end = Number(endP.dataset.start) + prefixLength(endP, range.endContainer, range.endOffset);
      if (end <= start) return;
      const rect = range.getBoundingClientRect();
      const cRect = containerRef.current.getBoundingClientRect();
      onSelect({
        start,
        end,
        text: layout.plain.slice(start, end),
        x: rect.left + rect.width / 2 - cRect.left,
        y: rect.top - cRect.top,
      });
    }, 0);
  };

  const openHighlightAt = (target: HTMLElement) => {
    if (!containerRef.current) return;
    const rect = target.getBoundingClientRect();
    const cRect = containerRef.current.getBoundingClientRect();
    onHighlightClick(target.dataset.hid!, rect.left + rect.width / 2 - cRect.left, rect.top - cRect.top);
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-hid]');
    if (target) openHighlightAt(target);
  };

  // role="button" spans don't get native Enter/Space activation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-hid]');
    if (!target) return;
    e.preventDefault();
    openHighlightAt(target);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-reading animate-pulse space-y-4 py-10" aria-label="Loading chapter text">
        <div className="mx-auto h-7 w-2/3 rounded bg-surface" />
        <div className="h-40" />
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-4 rounded bg-surface" style={{ width: `${85 + ((i * 7) % 15)}%` }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-reading py-16 text-center">
        <p className="font-body text-muted">{error}</p>
        <button
          onClick={onRetry}
          className="mt-4 rounded-lg border border-gold px-4 py-2 text-sm text-gold transition-colors hover:bg-gold-faint"
        >
          Try again
        </button>
      </div>
    );
  }

  if (!text || !layout) return null;

  return (
    <div
      ref={containerRef}
      className="relative mx-auto max-w-reading"
      onMouseUp={handlePointerUp}
      onTouchEnd={handlePointerUp}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <h2 className="mb-8 mt-2 text-center font-display text-2xl font-semibold leading-snug md:text-3xl">
        {text.title}
      </h2>
      <div className="reading-text pb-8">
        {text.paragraphs.map((para, i) => (
          <Paragraph
            key={i}
            para={para}
            paraStart={layout.paragraphStarts[i]}
            pIdx={i}
            highlights={highlightsByPara.get(i) ?? NO_HIGHLIGHTS}
            activeRange={activeParagraph === i ? activeRange : null}
            italics={text.italics?.[i] ?? NO_ITALICS}
            registerRef={registerRef}
            flash={flashPara === i}
          />
        ))}
      </div>
      {children}
    </div>
  );
}
