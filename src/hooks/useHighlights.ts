import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useAuth } from './useAuth';
import type { Bookmark, Highlight } from '../data/types';

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

  const filterScope = <T extends { bookSlug: string }>(items: T[]) =>
    bookSlug ? items.filter((i) => i.bookSlug === bookSlug) : items;

  const highlights = user ? cloudHighlights : filterScope(localHighlights);
  const bookmarks = user ? cloudBookmarks : filterScope(localBookmarks);

  const addHighlight = useCallback(
    async (slug: string, chapterIndex: number, startOffset: number, endOffset: number, text: string) => {
      if (user && supabase) {
        const { data, error } = await supabase
          .from('highlights')
          .insert({
            user_id: user.id,
            book_slug: slug,
            chapter_index: chapterIndex,
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
          chapterIndex,
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
        chapterIndex,
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
      const existing = bookmarks.find((b) => b.bookSlug === slug && b.chapterIndex === chapterIndex);
      if (user && supabase) {
        if (existing) {
          await supabase.from('bookmarks').delete().eq('id', existing.id).eq('user_id', user.id);
          setCloudBookmarks((prev) => prev.filter((b) => b.id !== existing.id));
        } else {
          const { data } = await supabase
            .from('bookmarks')
            .insert({ user_id: user.id, book_slug: slug, chapter_index: chapterIndex })
            .select('id')
            .single();
          if (data) {
            setCloudBookmarks((prev) => [
              ...prev,
              { id: data.id, bookSlug: slug, chapterIndex, createdAt: Date.now() },
            ]);
          }
        }
      } else if (existing) {
        store.removeLocalBookmark(existing.id);
      } else {
        store.addLocalBookmark({
          id: crypto.randomUUID(),
          bookSlug: slug,
          chapterIndex,
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
    loading,
    addHighlight,
    removeHighlight,
    setNote,
    toggleBookmark,
    isBookmarked,
  };
}
