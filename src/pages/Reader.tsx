import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import type { Book, ChapterText as ChapterTextData, WordTiming } from '../data/types';
import { getBook } from '../data/books';
import { loadChapterText } from '../lib/textLoader';
import { loadAlignment, findWordIndex } from '../lib/alignments';
import { layoutChapter } from '../lib/text';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useAnnotations } from '../hooks/useHighlights';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../lib/supabase';
import { AudioPlayerBar } from '../components/AudioPlayer';
import { ChapterList } from '../components/ChapterList';
import { ChapterText, type SelectionInfo } from '../components/ChapterText';
import { HighlightPopover } from '../components/HighlightPopover';
import { QuoteCard } from '../components/QuoteCard';
import { SearchBar } from '../components/SearchBar';
import { AuthModal } from '../components/AuthModal';
import { BookmarkIcon, ChevronLeftIcon, ListIcon, SearchIcon, XIcon } from '../components/icons';

export default function Reader() {
  const { slug } = useParams();
  const book = getBook(slug);
  if (!book) return <Navigate to="/" replace />;
  return <ReaderInner key={book.slug} book={book} />;
}

type PopoverState =
  | { kind: 'new'; sel: SelectionInfo }
  | { kind: 'existing'; id: string; x: number; y: number };

function ReaderInner({ book }: { book: Book }) {
  const player = useAudioPlayer(book);
  const { user } = useAuth();
  const annotations = useAnnotations(book.slug);
  const [searchParams, setSearchParams] = useSearchParams();

  const [chapterText, setChapterText] = useState<ChapterTextData | null>(null);
  const [textLoading, setTextLoading] = useState(true);
  const [textError, setTextError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const [alignment, setAlignment] = useState<WordTiming[] | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [quoteText, setQuoteText] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [guestToast, setGuestToast] = useState(false);
  const [scrollTarget, setScrollTarget] = useState<number | null>(null);
  const pendingScrollRef = useRef<{ chapter: number; para?: number; hlId?: string } | null>(null);

  // Deep links: ?chapter=N&p=M (bookmark/search) or ?chapter=N&hl=id (highlight)
  useEffect(() => {
    const chapterParam = searchParams.get('chapter');
    if (chapterParam === null) return;
    const chapter = Number(chapterParam);
    const p = searchParams.get('p');
    const hlId = searchParams.get('hl') ?? undefined;
    if (Number.isInteger(chapter) && chapter >= 0 && chapter < book.chapters.length) {
      pendingScrollRef.current = { chapter, para: p !== null ? Number(p) : undefined, hlId };
      if (chapter !== player.chapterIndex) player.setChapter(chapter, { autoplay: false });
    }
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load chapter text
  useEffect(() => {
    let cancelled = false;
    setTextLoading(true);
    setTextError(null);
    setPopover(null);
    loadChapterText(book.slug, player.chapterIndex)
      .then((text) => {
        if (!cancelled) setChapterText(text);
      })
      .catch(() => {
        if (!cancelled) {
          setChapterText(null);
          setTextError('The chapter text could not be loaded. It may not be cached for offline use yet.');
        }
      })
      .finally(() => {
        if (!cancelled) setTextLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [book.slug, player.chapterIndex, retryToken]);

  // Load word alignment (null → graceful chapter-level fallback)
  useEffect(() => {
    let cancelled = false;
    setAlignment(null);
    void loadAlignment(book.slug, player.chapterIndex).then((words) => {
      if (!cancelled) setAlignment(words);
    });
    return () => {
      cancelled = true;
    };
  }, [book.slug, player.chapterIndex]);

  // Chapter-level sync: a fresh chapter starts at the top
  const prevChapterRef = useRef(player.chapterIndex);
  useEffect(() => {
    if (prevChapterRef.current !== player.chapterIndex) {
      prevChapterRef.current = player.chapterIndex;
      if (!pendingScrollRef.current) window.scrollTo({ top: 0 });
    }
  }, [player.chapterIndex]);

  const layout = useMemo(() => (chapterText ? layoutChapter(chapterText) : null), [chapterText]);

  const chapterHighlights = useMemo(
    () => annotations.highlights.filter((h) => h.chapterIndex === player.chapterIndex),
    [annotations.highlights, player.chapterIndex],
  );

  // Word-level sync: current word → char range + paragraph
  const { activeRange, activeParagraph } = useMemo(() => {
    if (!alignment || !layout || layout.tokens.length === 0 || !player.isPlaying) {
      return { activeRange: null, activeParagraph: null };
    }
    const wordIdx = findWordIndex(alignment, player.currentTime);
    if (wordIdx < 0) return { activeRange: null, activeParagraph: null };
    const tokenIdx = Math.min(wordIdx, layout.tokens.length - 1);
    return {
      activeRange: layout.tokens[tokenIdx],
      activeParagraph: layout.tokenParagraph[tokenIdx],
    };
  }, [alignment, layout, player.currentTime, player.isPlaying]);

  // Resolve pending deep-link scrolls once everything needed has loaded
  useEffect(() => {
    const pending = pendingScrollRef.current;
    if (!pending || !layout || textLoading || pending.chapter !== player.chapterIndex) return;
    if (pending.hlId) {
      const h = annotations.highlights.find((x) => x.id === pending.hlId);
      if (!h) {
        if (!annotations.loading) pendingScrollRef.current = null;
        return;
      }
      let para = 0;
      for (let i = 0; i < layout.paragraphStarts.length; i++) {
        if (layout.paragraphStarts[i] <= h.startOffset) para = i;
        else break;
      }
      setScrollTarget(para);
    } else if (pending.para !== undefined) {
      setScrollTarget(pending.para);
    }
    pendingScrollRef.current = null;
  }, [layout, textLoading, player.chapterIndex, annotations.highlights, annotations.loading]);

  // Keyboard shortcuts: space = play/pause, ←/→ = skip 15s
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable) return;
      // Let a focused button take the space key (activate, not play/pause)
      if (e.key === ' ' && (t.tagName === 'BUTTON' || t.getAttribute('role') === 'button')) return;
      if (e.key === ' ') {
        e.preventDefault();
        player.toggle();
      } else if (e.key === 'ArrowLeft') {
        player.skip(-15);
      } else if (e.key === 'ArrowRight') {
        player.skip(15);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [player]);

  const closePopover = useCallback(() => setPopover(null), []);

  const doHighlight = async () => {
    if (popover?.kind !== 'new') return;
    const { sel } = popover;
    await annotations.addHighlight(book.slug, player.chapterIndex, sel.start, sel.end, sel.text);
    window.getSelection()?.removeAllRanges();
    setPopover(null);
    if (!user && isSupabaseConfigured) {
      setGuestToast(true);
      setTimeout(() => setGuestToast(false), 6000);
    }
  };

  const doSaveNote = async (content: string) => {
    if (!popover) return;
    if (popover.kind === 'new') {
      const created = await annotations.addHighlight(
        book.slug,
        player.chapterIndex,
        popover.sel.start,
        popover.sel.end,
        popover.sel.text,
      );
      if (created && content) await annotations.setNote(created.id, content);
      window.getSelection()?.removeAllRanges();
    } else {
      await annotations.setNote(popover.id, content || null);
    }
    setPopover(null);
  };

  const doQuote = () => {
    if (!popover) return;
    const text =
      popover.kind === 'new'
        ? popover.sel.text
        : annotations.highlights.find((h) => h.id === popover.id)?.text;
    if (text) setQuoteText(text);
    setPopover(null);
  };

  const doRemove = async () => {
    if (popover?.kind !== 'existing') return;
    await annotations.removeHighlight(popover.id);
    setPopover(null);
  };

  const navigateToResult = (chapterIndex: number, paragraphIndex: number) => {
    if (chapterIndex === player.chapterIndex) {
      setScrollTarget(paragraphIndex);
    } else {
      pendingScrollRef.current = { chapter: chapterIndex, para: paragraphIndex };
      player.setChapter(chapterIndex, { autoplay: false });
    }
  };

  const existingHighlight =
    popover?.kind === 'existing' ? annotations.highlights.find((h) => h.id === popover.id) : undefined;

  const currentBookmarked = annotations.isBookmarked(book.slug, player.chapterIndex);

  return (
    <div className="mx-auto flex max-w-6xl gap-6 px-4">
      {/* Desktop chapter sidebar */}
      <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem-9rem)] w-72 shrink-0 lg:block">
        <ChapterList
          book={book}
          currentChapter={player.chapterIndex}
          onSelect={(i) => player.setChapter(i)}
          isBookmarked={annotations.isBookmarked}
          onToggleBookmark={(s, c) => void annotations.toggleBookmark(s, c)}
        />
      </aside>

      <div className="min-w-0 flex-1 pb-44">
        {/* Reader toolbar */}
        <div className="sticky top-14 z-30 -mx-4 flex items-center gap-1 border-b border-edge bg-page/90 px-4 py-2 backdrop-blur-md">
          <Link
            to="/"
            className="flex items-center gap-0.5 rounded-lg py-1 pr-2 text-sm text-muted transition-colors hover:text-ink"
          >
            <ChevronLeftIcon size={17} />
            Library
          </Link>
          <div className="min-w-0 flex-1 px-2 text-center">
            <p className="truncate font-display text-sm font-semibold">{book.title}</p>
            <p className="truncate text-xs text-muted">{book.author}</p>
          </div>
          <button
            onClick={() => void annotations.toggleBookmark(book.slug, player.chapterIndex)}
            aria-label={currentBookmarked ? 'Remove bookmark from this chapter' : 'Bookmark this chapter'}
            aria-pressed={currentBookmarked}
            className={`rounded-lg p-2 transition-colors hover:bg-surface ${currentBookmarked ? 'text-gold' : 'text-muted hover:text-ink'}`}
          >
            <BookmarkIcon size={18} filled={currentBookmarked} />
          </button>
          <button
            onClick={() => setSearchOpen(true)}
            aria-label={`Search within ${book.title}`}
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <SearchIcon size={18} />
          </button>
          <button
            onClick={() => setChaptersOpen(true)}
            aria-label="Open chapter list"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-ink lg:hidden"
          >
            <ListIcon size={18} />
          </button>
        </div>

        <div className="pt-8">
          <ChapterText
            text={chapterText}
            layout={layout}
            loading={textLoading}
            error={textError}
            onRetry={() => setRetryToken((t) => t + 1)}
            highlights={chapterHighlights}
            activeRange={activeRange}
            activeParagraph={activeParagraph}
            onSelect={(sel) => setPopover({ kind: 'new', sel })}
            onHighlightClick={(id, x, y) => setPopover({ kind: 'existing', id, x, y })}
            scrollTarget={scrollTarget}
            onScrolledToTarget={() => setScrollTarget(null)}
          >
            {popover && (
              <HighlightPopover
                x={popover.kind === 'new' ? popover.sel.x : popover.x}
                y={popover.kind === 'new' ? popover.sel.y : popover.y}
                mode={popover.kind}
                existingNote={existingHighlight?.note}
                onHighlight={() => void doHighlight()}
                onSaveNote={(c) => void doSaveNote(c)}
                onQuote={doQuote}
                onRemove={() => void doRemove()}
                onClose={closePopover}
              />
            )}
          </ChapterText>
        </div>
      </div>

      <AudioPlayerBar book={book} player={player} />

      {/* Mobile chapter bottom sheet */}
      {chaptersOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Chapters">
          <div className="absolute inset-0 bg-black/60 animate-fade-in" onClick={() => setChaptersOpen(false)} />
          <div className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-hidden rounded-t-2xl border-t border-edge bg-surface shadow-pop animate-slide-up">
            <div className="flex justify-end px-2 pt-2">
              <button
                onClick={() => setChaptersOpen(false)}
                aria-label="Close chapter list"
                className="rounded-lg p-1.5 text-muted hover:text-ink"
              >
                <XIcon size={18} />
              </button>
            </div>
            <div className="max-h-[calc(75vh-2.5rem)] overflow-y-auto pb-4">
              <ChapterList
                book={book}
                currentChapter={player.chapterIndex}
                onSelect={(i) => {
                  player.setChapter(i);
                  setChaptersOpen(false);
                }}
                isBookmarked={annotations.isBookmarked}
                onToggleBookmark={(s, c) => void annotations.toggleBookmark(s, c)}
              />
            </div>
          </div>
        </div>
      )}

      {searchOpen && <SearchBar book={book} onNavigate={navigateToResult} onClose={() => setSearchOpen(false)} />}
      {quoteText && <QuoteCard book={book} quote={quoteText} onClose={() => setQuoteText(null)} />}
      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

      {guestToast && (
        <div className="fixed bottom-40 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-edge bg-surface px-4 py-2.5 text-sm shadow-pop animate-slide-up">
          <span>Saved on this device.</span>
          <button
            className="font-semibold text-gold hover:text-gold-bright"
            onClick={() => {
              setGuestToast(false);
              setAuthOpen(true);
            }}
          >
            Sign in to sync
          </button>
        </div>
      )}
    </div>
  );
}
