import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Book } from '../data/types';
import { formatDuration } from '../lib/format';

interface BookCardProps {
  book: Book;
  /** 0–100, omit/0 to hide the progress bar */
  progressPercent?: number;
  /** "X people reading" — hidden when 0/undefined */
  readers?: number;
}

export function BookCard({ book, progressPercent = 0, readers = 0 }: BookCardProps) {
  const [coverFailed, setCoverFailed] = useState(false);
  const showCover = book.coverUrl && !coverFailed;

  return (
    <Link
      to={`/book/${book.slug}`}
      className="group block rounded-xl outline-none transition-transform focus-visible:ring-2 focus-visible:ring-gold hover:-translate-y-1"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-surface shadow-card transition-shadow group-hover:shadow-card-hover">
        {showCover ? (
          <img
            src={book.coverUrl}
            alt={`Cover of ${book.title}`}
            loading="lazy"
            onError={() => setCoverFailed(true)}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 border border-edge p-4 text-center">
            <span className="font-display text-lg font-semibold leading-snug">{book.title}</span>
            <span className="h-px w-10 bg-gold" aria-hidden="true" />
            <span className="font-body text-sm italic text-muted">{book.author}</span>
          </div>
        )}
        {readers > 0 && (
          <span className="absolute right-2 top-2 flex items-center gap-1.5 rounded-full bg-charcoal/80 px-2 py-0.5 text-[11px] font-medium text-parchment backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
            {readers} reading
          </span>
        )}
        {progressPercent > 0 && (
          <div
            className="absolute inset-x-0 bottom-0 h-1 bg-black/40"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progressPercent}% complete`}
          >
            <div className="h-full bg-gold" style={{ width: `${progressPercent}%` }} />
          </div>
        )}
      </div>
      <div className="mt-2.5 px-0.5">
        <h3 className="line-clamp-2 font-display text-[15px] font-semibold leading-snug group-hover:text-gold-bright">
          {book.title}
        </h3>
        <p className="mt-0.5 text-[13px] text-muted">{book.author}</p>
        <p className="mt-0.5 text-xs text-muted">
          {formatDuration(book.totalDuration)}
          {progressPercent > 0 && <span className="text-gold"> · {progressPercent}%</span>}
        </p>
      </div>
    </Link>
  );
}
