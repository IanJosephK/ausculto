import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { books, GENRES, type Genre } from '../data/books';
import { BookCard } from '../components/BookCard';
import { SearchIcon, XIcon } from '../components/icons';
import { useStore } from '../store/useStore';
import { useReaderCounts } from '../hooks/useReaderCounts';
import { bookPercent } from '../hooks/useReadingProgress';
import { formatDuration } from '../lib/format';

export default function Library() {
  const [genre, setGenre] = useState<Genre>('All');
  const [query, setQuery] = useState('');
  const progress = useStore((s) => s.progress);
  const readerCounts = useReaderCounts();

  const continueReading = useMemo(() => {
    return Object.entries(progress)
      .map(([slug, p]) => ({ book: books.find((b) => b.slug === slug), p }))
      .filter((e): e is { book: (typeof books)[number]; p: (typeof progress)[string] } => !!e.book)
      .sort((a, b) => b.p.updatedAt - a.p.updatedAt)
      .slice(0, 3);
  }, [progress]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return books.filter(
      (b) =>
        (genre === 'All' || b.genre === genre) &&
        (q === '' || b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q)),
    );
  }, [genre, query]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      {/* Continue reading */}
      {continueReading.length > 0 && (
        <section aria-label="Continue reading" className="pt-6">
          <h2 className="font-display text-lg font-semibold">Continue reading</h2>
          <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2">
            {continueReading.map(({ book, p }) => {
              const pct = bookPercent(book, p);
              return (
                <Link
                  key={book.slug}
                  to={`/book/${book.slug}`}
                  className="group flex w-72 shrink-0 gap-3 rounded-xl border border-edge bg-surface p-3 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-card-hover"
                >
                  <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md bg-surface2">
                    {book.coverUrl ? (
                      <img src={book.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center p-1 text-center font-display text-[10px] leading-tight">
                        {book.title}
                      </div>
                    )}
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="line-clamp-2 font-display text-sm font-semibold leading-snug group-hover:text-gold-bright">
                      {book.title}
                    </h3>
                    <p className="mt-0.5 truncate text-xs text-muted">
                      Chapter {p.chapterIndex + 1} of {book.chapters.length}
                    </p>
                    <div className="mt-auto">
                      <div
                        className="h-1.5 w-full overflow-hidden rounded-full bg-surface2"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(2, pct)}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-muted">
                        <span className="font-medium text-gold">{pct}%</span> ·{' '}
                        {formatDuration(Math.round(book.totalDuration * (1 - pct / 100)))} left
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Search + genre filter */}
      <div className="sticky top-14 z-30 -mx-4 bg-page/90 px-4 pb-3 pt-5 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 flex-wrap gap-1.5" role="tablist" aria-label="Filter by genre">
            {GENRES.map((g) => (
              <button
                key={g}
                role="tab"
                aria-selected={genre === g}
                onClick={() => setGenre(g)}
                className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors ${
                  genre === g
                    ? 'bg-gold text-charcoal'
                    : 'border border-edge text-muted hover:border-gold/60 hover:text-ink'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="relative">
            <SearchIcon size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="library-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Title or author…"
              aria-label="Search the library by title or author"
              className="w-44 rounded-full border border-edge bg-surface py-1.5 pl-8 pr-7 text-[13px] outline-none transition-all placeholder:text-muted focus:w-56 focus:border-gold"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
              >
                <XIcon size={13} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Book grid */}
      {visible.length === 0 ? (
        <p className="py-16 text-center font-body text-muted">
          No books match{query ? ` “${query}”` : ''} in {genre}.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {visible.map((book) => (
            <BookCard
              key={book.slug}
              book={book}
              progressPercent={bookPercent(book, progress[book.slug])}
              readers={readerCounts[book.slug] ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
