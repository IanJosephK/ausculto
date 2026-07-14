import { useState } from 'react';
import type { Book } from '../data/types';
import { formatDuration } from '../lib/format';
import { downloadBookForOffline } from '../lib/offline';
import { useStore } from '../store/useStore';
import { BookmarkIcon, CheckIcon, DownloadIcon, SpinnerIcon } from './icons';

interface ChapterListProps {
  book: Book;
  currentChapter: number;
  onSelect: (index: number) => void;
  isBookmarked: (slug: string, chapter: number) => boolean;
  onToggleBookmark: (slug: string, chapter: number) => void;
}

export function ChapterList({
  book,
  currentChapter,
  onSelect,
  isBookmarked,
  onToggleBookmark,
}: ChapterListProps) {
  const downloaded = useStore((s) => s.downloaded.includes(book.slug));
  const setDownloaded = useStore((s) => s.setDownloaded);
  const [downloading, setDownloading] = useState<{ done: number; total: number } | null>(null);

  const startDownload = async () => {
    if (downloading) return;
    setDownloading({ done: 0, total: book.chapters.length });
    const ok = await downloadBookForOffline(book, (done, total) => setDownloading({ done, total }));
    setDownloading(null);
    if (ok) setDownloaded(book.slug, true);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-edge px-4 py-3">
        <h2 className="font-display text-base font-semibold">Chapters</h2>
        <button
          onClick={() => void startDownload()}
          disabled={!!downloading || downloaded}
          aria-label={
            downloaded
              ? 'Downloaded for offline listening'
              : downloading
                ? `Downloading, ${downloading.done} of ${downloading.total} chapters`
                : 'Download all chapters for offline listening'
          }
          className="flex items-center gap-1.5 rounded-lg border border-edge px-2.5 py-1.5 text-xs text-muted transition-colors hover:border-gold hover:text-gold disabled:hover:border-edge disabled:hover:text-muted"
        >
          {downloaded ? (
            <>
              <CheckIcon size={14} className="text-gold" /> Offline
            </>
          ) : downloading ? (
            <>
              <SpinnerIcon size={14} />
              {downloading.done}/{downloading.total}
            </>
          ) : (
            <>
              <DownloadIcon size={14} /> Download
            </>
          )}
        </button>
      </div>

      <ol className="flex-1 overflow-y-auto py-1" aria-label="Chapter list">
        {book.chapters.map((chapter, i) => {
          const current = i === currentChapter;
          const bookmarked = isBookmarked(book.slug, i);
          return (
            <li key={i} className="group/item flex items-stretch">
              <button
                onClick={() => onSelect(i)}
                aria-current={current ? 'true' : undefined}
                className={`flex min-w-0 flex-1 items-baseline gap-2.5 border-l-2 px-4 py-2.5 text-left text-sm transition-colors ${
                  current
                    ? 'border-gold bg-gold-faint text-gold-bright'
                    : 'border-transparent text-ink hover:bg-surface2/50'
                }`}
              >
                <span className={`w-6 shrink-0 font-ui text-xs tabular-nums ${current ? 'text-gold' : 'text-muted'}`}>
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{chapter.title}</span>
                <span className="shrink-0 font-ui text-xs text-muted">
                  {formatDuration(chapter.duration)}
                </span>
              </button>
              <button
                onClick={() => onToggleBookmark(book.slug, i)}
                aria-label={bookmarked ? `Remove bookmark from ${chapter.title}` : `Bookmark ${chapter.title}`}
                aria-pressed={bookmarked}
                className={`px-2 transition-opacity ${
                  bookmarked
                    ? 'text-gold'
                    : 'text-muted opacity-0 hover:text-ink focus-visible:opacity-100 group-hover/item:opacity-100'
                }`}
              >
                <BookmarkIcon size={15} filled={bookmarked} />
              </button>
            </li>
          );
        })}
      </ol>

      {book.textMapping !== 'exact' && (
        <p className="border-t border-edge px-4 py-2.5 text-[11px] leading-snug text-muted">
          Text is approximately aligned to this recording's chapters.
        </p>
      )}
    </div>
  );
}
