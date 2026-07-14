import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Bookmark, BookProgress, Highlight } from '../data/types';

export type Theme = 'dark' | 'light';
export type PlaybackSpeed = 0.75 | 1 | 1.25 | 1.5 | 2;
export const PLAYBACK_SPEEDS: PlaybackSpeed[] = [0.75, 1, 1.25, 1.5, 2];

interface AppState {
  theme: Theme;
  setTheme: (theme: Theme) => void;

  playbackSpeed: PlaybackSpeed;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;

  /** Per-book reading position, keyed by slug. Guest source of truth. */
  progress: Record<string, BookProgress>;
  setProgress: (slug: string, progress: Partial<BookProgress>) => void;
  /** Bulk merge from cloud sync — newest updatedAt wins per book. */
  mergeProgress: (remote: Record<string, BookProgress>) => void;

  /** Slugs of finished books (last chapter played to the end) */
  completed: string[];
  markCompleted: (slug: string) => void;

  /** Guest-mode annotations (cloud is the source of truth when signed in) */
  bookmarks: Bookmark[];
  highlights: Highlight[];
  addLocalBookmark: (bookmark: Bookmark) => void;
  removeLocalBookmark: (id: string) => void;
  addLocalHighlight: (highlight: Highlight) => void;
  removeLocalHighlight: (id: string) => void;
  setLocalNote: (highlightId: string, note: string | null) => void;

  /** Seconds listened per local day ("YYYY-MM-DD"), for streaks + stats */
  activity: Record<string, number>;
  addActivity: (dateKey: string, seconds: number) => void;

  /** Books the user chose to download for offline listening */
  downloaded: string[];
  setDownloaded: (slug: string, downloaded: boolean) => void;

  /** Install-prompt bookkeeping: total listening seconds + dismissal */
  totalListenSeconds: number;
  installPromptDismissed: boolean;
  dismissInstallPrompt: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      theme: 'dark',
      setTheme: (theme) => set({ theme }),

      playbackSpeed: 1,
      setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),

      progress: {},
      setProgress: (slug, partial) =>
        set((state) => {
          const existing: BookProgress = state.progress[slug] ?? {
            chapterIndex: 0,
            position: 0,
            updatedAt: 0,
          };
          return {
            progress: {
              ...state.progress,
              [slug]: { ...existing, ...partial, updatedAt: Date.now() },
            },
          };
        }),
      mergeProgress: (remote) =>
        set((state) => {
          const merged = { ...state.progress };
          for (const [slug, rp] of Object.entries(remote)) {
            const local = merged[slug];
            if (!local || rp.updatedAt > local.updatedAt) merged[slug] = rp;
          }
          return { progress: merged };
        }),

      completed: [],
      markCompleted: (slug) =>
        set((state) =>
          state.completed.includes(slug) ? state : { completed: [...state.completed, slug] },
        ),

      bookmarks: [],
      highlights: [],
      addLocalBookmark: (bookmark) => set((s) => ({ bookmarks: [...s.bookmarks, bookmark] })),
      removeLocalBookmark: (id) => set((s) => ({ bookmarks: s.bookmarks.filter((b) => b.id !== id) })),
      addLocalHighlight: (highlight) => set((s) => ({ highlights: [...s.highlights, highlight] })),
      removeLocalHighlight: (id) => set((s) => ({ highlights: s.highlights.filter((h) => h.id !== id) })),
      setLocalNote: (highlightId, note) =>
        set((s) => ({
          highlights: s.highlights.map((h) => (h.id === highlightId ? { ...h, note } : h)),
        })),

      activity: {},
      addActivity: (dateKey, seconds) =>
        set((s) => ({
          activity: { ...s.activity, [dateKey]: (s.activity[dateKey] ?? 0) + seconds },
          totalListenSeconds: s.totalListenSeconds + seconds,
        })),

      downloaded: [],
      setDownloaded: (slug, downloaded) =>
        set((s) => ({
          downloaded: downloaded
            ? [...new Set([...s.downloaded, slug])]
            : s.downloaded.filter((d) => d !== slug),
        })),

      totalListenSeconds: 0,
      installPromptDismissed: false,
      dismissInstallPrompt: () => set({ installPromptDismissed: true }),
    }),
    { name: 'ausculto' },
  ),
);
