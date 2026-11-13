import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useAuth } from './useAuth';
import type { Bookmark, Highlight } from '../data/types';
import { getBook } from '../data/books';
import { currentChapterIndex, storedChapterIndex } from '../lib/bookMapping';
import { loadAllChapterTexts } from '../lib/textLoader';
import { relocateHighlight } from '../lib/annotationMapping';

/**
 * Bookmarks, highlights, and notes. Signed in → Supabase; guest → the
 * persisted Zustand store. Pass a bookSlug to scope to one book, or nothing
 * for everything (the My Library page).
 */
export function useAnnotations(bookSlug?: string) {
  const { user } = useAuth();
  const localHighlights = useStore((s) => s.highlights);
  const localBookmarks = useStore((s) => s.bookmarks);
  const store = useStore.getState();

  const [cloudHighlights, setCloudHighlights] = useState<Highlight[]>([]);
  const [cloudBookmarks, setCloudBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user || !supabase) return;
    setLoading(true);
    try {
      let hq = supabase
        .from('highlights')
        .select('id, book_slug, chapter_index, start_offset, end_offset, text_snippet, created_at, notes(content)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      let bq = supabase
        .from('bookmarks')
        .select('id, book_slug, chapter_index, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });
      if (bookSlug) {
        hq = hq.eq('book_slug', bookSlug);
        bq = bq.eq('book_slug', bookSlug);
      }
      const [{ data: hs }, { data: bs }] = await Promise.all([hq, bq]);
      setCloudHighlights(
        (hs ?? []).map((h) => ({
          id: h.id as string,
          bookSlug: h.book_slug as string,
          chapterIndex: h.chapter_index as number,
          startOffset: h.start_offset as number,
          endOffset: h.end_offset as number,
          text: h.text_snippet as string,
          note: (h.notes as { content: string }[] | null)?.[0]?.content ?? null,
          createdAt: new Date(h.created_at as string).getTime(),
        })),
      );
      setCloudBookmarks(
        (bs ?? []).map((b) => ({
          id: b.id as string,
          bookSlug: b.book_slug as string,
          chapterIndex: b.chapter_index as number,
          createdAt: new Date(b.created_at as string).getTime(),
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [user, bookSlug]);

  useEffect(() => {
    if (user) void refresh();
  }, [user, refresh]);

  const storedHighlights = useMemo(() => {
    const items = user ? cloudHighlights : localHighlights;
    return bookSlug ? items.filter(h => h.bookSlug === bookSlug) : items;
  }, [user, cloudHighlights, localHighlights, bookSlug]);
  const storedBookmarks = useMemo(() => {
    const items = user ? cloudBookmarks : localBookmarks;
    return bookSlug ? items.filter(b => b.bookSlug === bookSlug) : items;
  }, [user, cloudBookmarks, localBookmarks, bookSlug]);
  const bookmarks = useMemo(() => storedBookmarks.map(b => {
    const book = getBook(b.bookSlug);
    return book ? { ...b, chapterIndex: currentChapterIndex(book, b.chapterIndex) } : b;
  }), [storedBookmarks]);
  const [relocated, setRelocated] = useState<{ input: Highlight[]; values: Highlight[] } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const slugs = [...new Set(storedHighlights.map(h => h.bookSlug))];
    void Promise.all(slugs.map(async slug => {
      const book = getBook(slug);
      if (!book) return [slug, null] as const;
      try {
        const texts = await loadAllChapterTexts(book);
        return [slug, texts.map(t => t.paragraphs.join('\n\n'))] as const;
      } catch { return [slug, null] as const; }
    })).then(entries => {
      if (cancelled) return;
      const plains = new Map(entries);
      setRelocated({ input: storedHighlights, values: storedHighlights.map(h => {
        const book = getBook(h.bookSlug);
        const texts = plains.get(h.bookSlug);
        return book && texts ? relocateHighlight(h, book, texts) : { ...h, unresolved: true };
      }) });
    });
    return () => { cancelled = true; };
  }, [storedHighlights]);
  const highlights = relocated?.input === storedHighlights ? relocated.values : storedHighlights.map(h => ({ ...h, unresolved: true }));

  const addHighlight = useCallback(
    async (slug: string, chapterIndex: number, startOffset: number, endOffset: number, text: string) => {
      const book = getBook(slug);
      const storageIndex = book ? storedChapterIndex(book, chapterIndex) : chapterIndex;
      if (user && supabase) {
        const { data, error } = await supabase
          .from('highlights')
          .insert({
            user_id: user.id,
            book_slug: slug,
            chapter_index: storageIndex,
            start_offset: startOffset,
            end_offset: endOffset,
            text_snippet: text,
          })
          .select('id')
          .single();
        if (error || !data) return null;
        const created: Highlight = {
          id: data.id,
          bookSlug: slug,
          chapterIndex: storageIndex,
          textRevision: book?.textRevision,
          startOffset,
          endOffset,
          text,
          note: null,
          createdAt: Date.now(),
        };
        setCloudHighlights((prev) => [...prev, created]);
        return created;
      }
      const created: Highlight = {
        id: crypto.randomUUID(),
        bookSlug: slug,
        chapterIndex: storageIndex,
        textRevision: book?.textRevision,
        startOffset,
        endOffset,
        text,
        note: null,
        createdAt: Date.now(),
      };
      store.addLocalHighlight(created);
      return created;
    },
    [user, store],
  );

  const removeHighlight = useCallback(
    async (id: string) => {
      if (user && supabase) {
        await supabase.from('highlights').delete().eq('id', id).eq('user_id', user.id);
        setCloudHighlights((prev) => prev.filter((h) => h.id !== id));
      } else {
        store.removeLocalHighlight(id);
      }
    },
    [user, store],
  );

  const setNote = useCallback(
    async (highlightId: string, content: string | null) => {
      if (user && supabase) {
        if (content) {
          await supabase
            .from('notes')
            .upsert(
              { user_id: user.id, highlight_id: highlightId, content, updated_at: new Date().toISOString() },
              { onConflict: 'highlight_id' },
            );
        } else {
          await supabase.from('notes').delete().eq('highlight_id', highlightId).eq('user_id', user.id);
        }
        setCloudHighlights((prev) =>
          prev.map((h) => (h.id === highlightId ? { ...h, note: content } : h)),
        );
      } else {
        store.setLocalNote(highlightId, content);
      }
    },
    [user, store],
  );

  const toggleBookmark = useCallback(
    async (slug: string, chapterIndex: number) => {
      const existing = bookmarks.filter((b) => b.bookSlug === slug && b.chapterIndex === chapterIndex);
      const book = getBook(slug);
      const storageIndex = book ? storedChapterIndex(book, chapterIndex) : chapterIndex;
      if (user && supabase) {
        if (existing.length) {
          await supabase.from('bookmarks').delete().in('id', existing.map(b => b.id)).eq('user_id', user.id);
          setCloudBookmarks((prev) => prev.filter((b) => !existing.some(e => e.id === b.id)));
        } else {
          const { data } = await supabase
            .from('bookmarks')
            .insert({ user_id: user.id, book_slug: slug, chapter_index: storageIndex })
            .select('id')
            .single();
          if (data) {
            setCloudBookmarks((prev) => [
              ...prev,
              { id: data.id, bookSlug: slug, chapterIndex: storageIndex, createdAt: Date.now() },
            ]);
          }
        }
      } else if (existing.length) {
        existing.forEach(b => store.removeLocalBookmark(b.id));
      } else {
        store.addLocalBookmark({
          id: crypto.randomUUID(),
          bookSlug: slug,
          chapterIndex: storageIndex,
          createdAt: Date.now(),
        });
      }
    },
    [user, store, bookmarks],
  );

  const isBookmarked = useCallback(
    (slug: string, chapterIndex: number) =>
      bookmarks.some((b) => b.bookSlug === slug && b.chapterIndex === chapterIndex),
    [bookmarks],
  );

  return {
    highlights,
    bookmarks,
    loading: loading || (storedHighlights.length > 0 && relocated?.input !== storedHighlights),
    addHighlight,
    removeHighlight,
    setNote,
    toggleBookmark,
    isBookmarked,
  };
}
