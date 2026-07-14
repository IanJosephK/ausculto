import type { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { useStore } from '../store/useStore';
import type { BookProgress } from '../data/types';

/**
 * Two-way reconciliation when a user signs in:
 *  - reading progress: newest updatedAt wins, per book, in both directions
 *  - guest bookmarks/highlights/notes: pushed to the cloud once, if the same
 *    spot isn't already saved there
 * Guest-local copies are kept — the cloud is simply the source of truth while
 * signed in.
 */
export async function syncOnLogin(user: User): Promise<void> {
  if (!supabase) return;
  try {
    await Promise.all([syncProgress(user), pushGuestAnnotations(user)]);
  } catch (err) {
    console.warn('[ausculto] cloud sync failed:', err);
  }
}

async function syncProgress(user: User) {
  if (!supabase) return;
  const { data: remoteRows } = await supabase
    .from('reading_progress')
    .select('book_slug, chapter_index, audio_position_seconds, updated_at')
    .eq('user_id', user.id);

  const local = useStore.getState().progress;
  const remote: Record<string, BookProgress> = {};
  for (const row of remoteRows ?? []) {
    remote[row.book_slug] = {
      chapterIndex: row.chapter_index,
      position: row.audio_position_seconds,
      updatedAt: new Date(row.updated_at).getTime(),
    };
  }

  // Pull: remote entries that are newer (or missing locally)
  useStore.getState().mergeProgress(remote);

  // Push: local entries that are newer (or missing remotely)
  const toPush = Object.entries(local)
    .filter(([slug, lp]) => !remote[slug] || lp.updatedAt > remote[slug].updatedAt)
    .map(([slug, lp]) => ({
      user_id: user.id,
      book_slug: slug,
      chapter_index: lp.chapterIndex,
      audio_position_seconds: lp.position,
      updated_at: new Date(lp.updatedAt).toISOString(),
    }));
  if (toPush.length) {
    await supabase.from('reading_progress').upsert(toPush, { onConflict: 'user_id,book_slug' });
  }
}

async function pushGuestAnnotations(user: User) {
  if (!supabase) return;
  const { bookmarks, highlights } = useStore.getState();

  if (bookmarks.length) {
    await supabase.from('bookmarks').upsert(
      bookmarks.map((b) => ({
        user_id: user.id,
        book_slug: b.bookSlug,
        chapter_index: b.chapterIndex,
      })),
      { onConflict: 'user_id,book_slug,chapter_index', ignoreDuplicates: true },
    );
  }

  if (highlights.length) {
    // Skip highlights already saved at the same spot
    const { data: existing } = await supabase
      .from('highlights')
      .select('book_slug, chapter_index, start_offset')
      .eq('user_id', user.id);
    const seen = new Set(
      (existing ?? []).map((h) => `${h.book_slug}/${h.chapter_index}/${h.start_offset}`),
    );
    for (const h of highlights) {
      if (seen.has(`${h.bookSlug}/${h.chapterIndex}/${h.startOffset}`)) continue;
      const { data: inserted } = await supabase
        .from('highlights')
        .insert({
          user_id: user.id,
          book_slug: h.bookSlug,
          chapter_index: h.chapterIndex,
          start_offset: h.startOffset,
          end_offset: h.endOffset,
          text_snippet: h.text,
        })
        .select('id')
        .single();
      if (h.note && inserted) {
        await supabase
          .from('notes')
          .insert({ user_id: user.id, highlight_id: inserted.id, content: h.note });
      }
    }
  }
}
