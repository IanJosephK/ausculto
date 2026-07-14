import { useEffect, useRef, useState } from 'react';
import type { Book } from '../data/types';
import { useBookSearch } from '../hooks/useSearch';
import { SearchIcon, SpinnerIcon, XIcon } from './icons';

interface SearchBarProps {
  book: Book;
  onNavigate: (chapterIndex: number, paragraphIndex: number) => void;
  onClose: () => void;
}

export function SearchBar({ book, onNavigate, onClose }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const { results, searching, indexing, search, clear } = useBookSearch(book);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const onChange = (value: string) => {
    setQuery(value);
    clearTimeout(debounceRef.current);
    if (value.trim().length < 3) {
      clear();
      return;
    }
    debounceRef.current = setTimeout(() => void search(value), 250);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Search within ${book.title}`}
    >
      <div
        className="mx-auto mt-[8vh] w-[calc(100%-2rem)] max-w-xl overflow-hidden rounded-2xl border border-edge bg-surface shadow-pop animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-edge px-4 py-3">
          <SearchIcon size={18} className="shrink-0 text-muted" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Search in ${book.title}…`}
            aria-label={`Search within ${book.title}`}
            className="min-w-0 flex-1 bg-transparent font-body text-base outline-none placeholder:text-muted"
          />
          {searching && <SpinnerIcon size={16} className="text-muted" />}
          <button onClick={onClose} aria-label="Close search" className="rounded-lg p-1 text-muted hover:text-ink">
            <XIcon size={18} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {indexing && (
            <p className="px-4 py-6 text-center text-sm text-muted">Building search index for this book…</p>
          )}
          {!indexing && query.trim().length >= 3 && !searching && results.length === 0 && (
            <p className="px-4 py-6 text-center text-sm text-muted">No passages found for “{query}”.</p>
          )}
          {query.trim().length > 0 && query.trim().length < 3 && (
            <p className="px-4 py-6 text-center text-sm text-muted">Type at least 3 characters.</p>
          )}
          {results.map((group) => (
            <section key={group.chapterIndex} aria-label={group.chapterTitle}>
              <h3 className="sticky top-0 bg-surface2/95 px-4 py-1.5 font-ui text-xs font-semibold uppercase tracking-wider text-muted backdrop-blur-sm">
                {group.chapterTitle}
              </h3>
              <ul>
                {group.matches.map((m) => (
                  <li key={`${m.item.chapterIndex}-${m.item.paragraphIndex}`}>
                    <button
                      onClick={() => {
                        onNavigate(m.item.chapterIndex, m.item.paragraphIndex);
                        onClose();
                      }}
                      className="w-full border-b border-edge px-4 py-3 text-left font-body text-sm leading-relaxed transition-colors hover:bg-gold-faint"
                    >
                      <Snippet text={m.item.text} query={query} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** ~200-char excerpt centred on the first occurrence, term emphasised. */
function Snippet({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  const center = idx === -1 ? 0 : idx;
  const from = Math.max(0, center - 80);
  const to = Math.min(text.length, center + q.length + 120);
  const excerpt = `${from > 0 ? '…' : ''}${text.slice(from, to)}${to < text.length ? '…' : ''}`;

  if (idx === -1) return <span className="text-muted">{excerpt}</span>;

  const relIdx = excerpt.toLowerCase().indexOf(q.toLowerCase());
  if (relIdx === -1) return <span className="text-muted">{excerpt}</span>;
  return (
    <span className="text-muted">
      {excerpt.slice(0, relIdx)}
      <mark className="rounded-sm bg-gold-faint px-0.5 font-semibold text-gold-bright">
        {excerpt.slice(relIdx, relIdx + q.length)}
      </mark>
      {excerpt.slice(relIdx + q.length)}
    </span>
  );
}
