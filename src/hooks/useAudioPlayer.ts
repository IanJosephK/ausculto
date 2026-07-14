import { useCallback, useEffect, useRef, useState } from 'react';
import type { Book } from '../data/types';
import { useStore, type PlaybackSpeed } from '../store/useStore';
import { recordActivity } from '../lib/activity';
import { precacheChapterAudio } from '../lib/offline';

// One shared <audio> element for the whole app — survives re-renders and
// React StrictMode double-mounts without restarting playback.
let sharedAudio: HTMLAudioElement | null = null;
function getAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = 'metadata';
  }
  return sharedAudio;
}

/** Flush listening time to stats in chunks of this many seconds. */
const ACTIVITY_FLUSH_SECONDS = 30;
/** Persist playback position at most this often while playing. */
const PROGRESS_SAVE_MS = 5000;

export interface AudioPlayer {
  chapterIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  error: string | null;
  speed: PlaybackSpeed;
  toggle: () => void;
  seek: (time: number) => void;
  skip: (deltaSeconds: number) => void;
  setChapter: (index: number, opts?: { autoplay?: boolean; position?: number }) => void;
  next: () => void;
  prev: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
}

export function useAudioPlayer(book: Book): AudioPlayer {
  const setProgress = useStore((s) => s.setProgress);
  const markCompleted = useStore((s) => s.markCompleted);
  const speed = useStore((s) => s.playbackSpeed);
  const setPlaybackSpeed = useStore((s) => s.setPlaybackSpeed);

  const savedProgress = useStore.getState().progress[book.slug];
  const [chapterIndex, setChapterIndex] = useState(() =>
    Math.min(savedProgress?.chapterIndex ?? 0, book.chapters.length - 1),
  );
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(book.chapters[chapterIndex]?.duration ?? 0);
  const [error, setError] = useState<string | null>(null);

  // Position to restore when the next chapter loads (initially: saved spot)
  const pendingPositionRef = useRef(savedProgress?.chapterIndex === chapterIndex ? savedProgress.position : 0);
  const autoplayRef = useRef(false);
  const lastSaveRef = useRef(0);
  const activityAccumRef = useRef(0);
  const lastTimeRef = useRef(0);
  const chapterIndexRef = useRef(chapterIndex);
  chapterIndexRef.current = chapterIndex;

  const flushActivity = useCallback(() => {
    if (activityAccumRef.current >= 1) {
      recordActivity(book.slug, chapterIndexRef.current, activityAccumRef.current);
      activityAccumRef.current = 0;
    }
  }, [book.slug]);

  // Load chapter audio when book/chapter changes
  useEffect(() => {
    const audio = getAudio();
    const chapter = book.chapters[chapterIndex];
    if (!chapter) return;

    setError(null);
    setCurrentTime(pendingPositionRef.current);
    setDuration(chapter.duration);
    audio.src = chapter.audioUrl;
    audio.playbackRate = useStore.getState().playbackSpeed;

    // Consumed only once metadata arrives, so an aborted load (or StrictMode
    // remount) doesn't lose the position we meant to restore.
    const restore = pendingPositionRef.current;
    const onLoadedMetadata = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
      if (restore > 1 && restore < audio.duration - 3) audio.currentTime = restore;
      pendingPositionRef.current = 0;
    };
    audio.addEventListener('loadedmetadata', onLoadedMetadata);

    if (autoplayRef.current) {
      autoplayRef.current = false;
      void audio.play().catch(() => setIsPlaying(false));
    }

    lastTimeRef.current = restore;
    setProgress(book.slug, { chapterIndex, position: restore });
    precacheChapterAudio(book, chapterIndex + 1);

    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: chapter.title,
        artist: book.author,
        album: book.title,
        artwork: book.coverUrl ? [{ src: book.coverUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
      });
    }

    return () => audio.removeEventListener('loadedmetadata', onLoadedMetadata);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.slug, chapterIndex]);

  // Wire audio element events once per book
  useEffect(() => {
    const audio = getAudio();

    const onTimeUpdate = () => {
      const t = audio.currentTime;
      setCurrentTime(t);
      // Accumulate real listening time (ignore seeks: delta must be small)
      const delta = t - lastTimeRef.current;
      if (delta > 0 && delta < 3) activityAccumRef.current += delta;
      lastTimeRef.current = t;
      if (activityAccumRef.current >= ACTIVITY_FLUSH_SECONDS) flushActivity();

      const now = Date.now();
      if (!audio.paused && now - lastSaveRef.current > PROGRESS_SAVE_MS) {
        lastSaveRef.current = now;
        setProgress(book.slug, { chapterIndex: chapterIndexRef.current, position: t });
      }
    };
    const onPlay = () => {
      setIsPlaying(true);
      setError(null);
    };
    const onPause = () => {
      setIsPlaying(false);
      setProgress(book.slug, { chapterIndex: chapterIndexRef.current, position: audio.currentTime });
      flushActivity();
    };
    const onEnded = () => {
      flushActivity();
      if (chapterIndexRef.current < book.chapters.length - 1) {
        autoplayRef.current = true;
        pendingPositionRef.current = 0;
        setChapterIndex(chapterIndexRef.current + 1);
      } else {
        markCompleted(book.slug);
        setIsPlaying(false);
      }
    };
    const onDurationChange = () => {
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration);
    };
    const onError = () => {
      if (audio.src) setError('Audio could not be loaded. Check your connection and try again.');
      setIsPlaying(false);
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('error', onError);

    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => void audio.play());
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => {
        audio.currentTime = Math.max(0, audio.currentTime - 15);
      });
      navigator.mediaSession.setActionHandler('seekforward', () => {
        audio.currentTime = Math.min(audio.duration || Infinity, audio.currentTime + 15);
      });
    }

    return () => {
      // Leaving the reader: remember the spot, stop playback, flush stats.
      // currentTime is 0 until metadata loads — saving it then would wipe the
      // real position (the chapter-load effect already saved the right spot).
      if (audio.currentTime > 0) {
        setProgress(book.slug, { chapterIndex: chapterIndexRef.current, position: audio.currentTime });
      }
      flushActivity();
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('seekbackward', null);
        navigator.mediaSession.setActionHandler('seekforward', null);
      }
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('error', onError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [book.slug]);

  const toggle = useCallback(() => {
    const audio = getAudio();
    if (audio.paused) void audio.play().catch(() => setError('Playback failed to start.'));
    else audio.pause();
  }, []);

  const seek = useCallback(
    (time: number) => {
      const audio = getAudio();
      const clamped = Math.max(0, Math.min(time, audio.duration || duration || 0));
      audio.currentTime = clamped;
      lastTimeRef.current = clamped;
      setCurrentTime(clamped);
    },
    [duration],
  );

  const skip = useCallback(
    (delta: number) => {
      seek(getAudio().currentTime + delta);
    },
    [seek],
  );

  const setChapter = useCallback(
    (index: number, opts?: { autoplay?: boolean; position?: number }) => {
      if (index < 0 || index >= book.chapters.length) return;
      autoplayRef.current = opts?.autoplay ?? !getAudio().paused;
      pendingPositionRef.current = opts?.position ?? 0;
      setChapterIndex(index);
    },
    [book.chapters.length],
  );

  const next = useCallback(() => setChapter(chapterIndex + 1), [setChapter, chapterIndex]);
  const prev = useCallback(() => setChapter(chapterIndex - 1), [setChapter, chapterIndex]);

  const setSpeed = useCallback(
    (s: PlaybackSpeed) => {
      setPlaybackSpeed(s);
      getAudio().playbackRate = s;
    },
    [setPlaybackSpeed],
  );

  return {
    chapterIndex,
    isPlaying,
    currentTime,
    duration,
    error,
    speed,
    toggle,
    seek,
    skip,
    setChapter,
    next,
    prev,
    setSpeed,
  };
}
