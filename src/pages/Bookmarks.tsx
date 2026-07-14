import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAnnotations } from '../hooks/useHighlights';
import { getBook } from '../data/books';
import { QuoteCard } from '../components/QuoteCard';
import { BookmarkIcon, PencilIcon, QuoteIcon, TrashIcon } from '../components/icons';
import type { Book, Highlight } from '../data/types';

export default function Bookmarks() {
  const annotations = useAnnotations();
  const [quote, setQuote] = useState<{ book: Book; text: string } | null>(null);
  const [editingNote, setEditingNote] = useState<{ id: string; draft: string } | null>(null);

  const highlightsByBook = useMemo(() => {
    const map = new Map<string, Highlight[]>();
    for (const h of annotations.highlights) {
      const arr = map.get(h.bookSlug) ?? [];
      arr.push(h);
      map.set(h.bookSlug, arr);
    }
    return map;
  }, [annotations.highlights]);

  const empty = annotations.bookmarks.length === 0 && annotations.highlights.length === 0;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold">My Library</h1>
      <p className="mt-1 text-sm text-muted">Your bookmarks, highlights, and notes.</p>

      {empty && (
        <div className="mt-12 text-center">
          <BookmarkIcon size={40} className="mx-auto text-muted" />
          <p className="mt-4 font-body text-muted">
            Nothing saved yet. Bookmark a chapter or select text in a book to highlight it.
          </p>
          <Link
            to="/"
            className="mt-4 inline-block rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-charcoal hover:bg-gold-bright"
          >
            Browse the library
          </Link>
        </div>
      )}

      {annotations.bookmarks.length > 0 && (
        <section aria-label="Bookmarks" className="mt-8">
          <h2 className="font-display text-lg font-semibold">Bookmarks</h2>
          <ul className="mt-3 space-y-2">
            {annotations.bookmarks.map((b) => {
              const book = getBook(b.bookSlug);
              if (!book) return null;
              const chapter = book.chapters[b.chapterIndex];
              return (
                <li
                  key={b.id}
                  className="flex items-center gap-3 rounded-xl border border-edge bg-surface px-4 py-3"
                >
                  <BookmarkIcon size={16} filled className="shrink-0 text-gold" />
                  <Link
                    to={`/book/${book.slug}?chapter=${b.chapterIndex}`}
                    className="min-w-0 flex-1 hover:text-gold-bright"
                  >
                    <p className="truncate text-sm font-medium">{chapter?.title ?? `Chapter ${b.chapterIndex + 1}`}</p>
                    <p className="truncate text-xs text-muted">
                      {book.title} · {book.author}
                    </p>
                  </Link>
                  <button
                    onClick={() => void annotations.toggleBookmark(b.bookSlug, b.chapterIndex)}
                    aria-label={`Remove bookmark from ${chapter?.title ?? 'chapter'}`}
                    className="rounded-lg p-1.5 text-muted hover:text-red-400"
                  >
                    <TrashIcon size={15} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {annotations.highlights.length > 0 && (
        <section aria-label="Highlights and notes" className="mt-10">
          <h2 className="font-display text-lg font-semibold">Highlights & notes</h2>
          {[...highlightsByBook.entries()].map(([slug, items]) => {
            const book = getBook(slug);
            if (!book) return null;
            return (
              <div key={slug} className="mt-4">
                <h3 className="font-ui text-xs font-semibold uppercase tracking-wider text-muted">
                  {book.title} — {book.author}
                </h3>
                <ul className="mt-2 space-y-3">
                  {items.map((h) => (
                    <li key={h.id} className="rounded-xl border border-edge bg-surface p-4">
                      <Link to={`/book/${slug}?chapter=${h.chapterIndex}&hl=${h.id}`}>
                        <blockquote className="border-l-2 border-gold pl-3 font-body text-sm italic leading-relaxed hover:text-gold-bright">
                          “{h.text.length > 240 ? `${h.text.slice(0, 240).trimEnd()}…` : h.text}”
                        </blockquote>
                      </Link>

                      {editingNote?.id === h.id ? (
                        <div className="mt-3">
                          <textarea
                            autoFocus
                            value={editingNote.draft}
                            onChange={(e) => setEditingNote({ id: h.id, draft: e.target.value })}
                            rows={2}
                            className="w-full resize-none rounded-lg border border-edge bg-page p-2 font-body text-sm outline-none focus:border-gold"
                          />
                          <div className="mt-1.5 flex justify-end gap-1.5">
                            <button
                              className="rounded-lg px-2.5 py-1 text-xs text-muted hover:text-ink"
                              onClick={() => setEditingNote(null)}
                            >
                              Cancel
                            </button>
                            <button
                              className="rounded-lg bg-gold px-2.5 py-1 text-xs font-semibold text-charcoal hover:bg-gold-bright"
                              onClick={() => {
                                void annotations.setNote(h.id, editingNote.draft.trim() || null);
                                setEditingNote(null);
                              }}
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        h.note && <p className="mt-2.5 rounded-lg bg-page px-3 py-2 text-sm text-muted">{h.note}</p>
                      )}

                      <div className="mt-3 flex items-center gap-1 text-muted">
                        <span className="flex-1 text-xs">
                          {getBook(slug)?.chapters[h.chapterIndex]?.title ?? `Chapter ${h.chapterIndex + 1}`}
                        </span>
                        <button
                          onClick={() => setEditingNote({ id: h.id, draft: h.note ?? '' })}
                          aria-label={h.note ? 'Edit note' : 'Add note'}
                          className="rounded-lg p-1.5 hover:text-ink"
                        >
                          <PencilIcon size={14} />
                        </button>
                        <button
                          onClick={() => setQuote({ book, text: h.text })}
                          aria-label="Share as quote"
                          className="rounded-lg p-1.5 hover:text-ink"
                        >
                          <QuoteIcon size={14} />
                        </button>
                        <button
                          onClick={() => void annotations.removeHighlight(h.id)}
                          aria-label="Delete highlight"
                          className="rounded-lg p-1.5 hover:text-red-400"
                        >
                          <TrashIcon size={14} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {quote && <QuoteCard book={quote.book} quote={quote.text} onClose={() => setQuote(null)} />}
    </div>
  );
}
