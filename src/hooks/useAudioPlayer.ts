import { useCallback, useEffect, useRef, useState } from 'react';
import type { Book } from '../data/types';
import { useStore, type PlaybackSpeed } from '../store/useStore';
import { recordActivity } from '../lib/activity';
import { precacheAudio } from '../lib/offline';
import { audioParts, fromStoredProgress, locateAudioPart, toStoredPosition } from '../lib/bookMapping';

let sharedAudio: HTMLAudioElement | null = null;
function getAudio(): HTMLAudioElement {
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.crossOrigin = 'anonymous';
    sharedAudio.preload = 'metadata';
  }
  return sharedAudio;
}

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

/** A chapter can span several recordings; the UI sees one continuous timeline. */
export function useAudioPlayer(book: Book): AudioPlayer {
  const setProgress = useStore(s => s.setProgress);
  const markCompleted = useStore(s => s.markCompleted);
  const speed = useStore(s => s.playbackSpeed);
  const setPlaybackSpeed = useStore(s => s.setPlaybackSpeed);
  const [initial] = useState(() => {
    const saved = fromStoredProgress(book, useStore.getState().progress[book.slug]);
    const index = Math.max(0, Math.min(saved?.chapterIndex ?? 0, book.chapters.length - 1));
    return { chapterIndex: index, ...locateAudioPart(book.chapters[index], saved?.position ?? 0) };
  });
  const [chapterIndex, setChapterIndex] = useState(initial.chapterIndex);
  const [partIndex, setPartIndex] = useState(initial.index);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(initial.offset + initial.position);
  const [duration, setDuration] = useState(book.chapters[initial.chapterIndex].duration);
  const [error, setError] = useState<string | null>(null);
  const chapter = book.chapters[chapterIndex];
  const parts = audioParts(chapter);
  const offset = parts.slice(0, partIndex).reduce((sum, p) => sum + p.duration, 0);
  const playbackRef = useRef({ chapterIndex, partIndex, offset });
  playbackRef.current = { chapterIndex, partIndex, offset };
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;
  const pendingPositionRef = useRef<number | null>(initial.position);
  const autoplayRef = useRef(false);
  const lastSaveRef = useRef(0);
  const activityRef = useRef(0);
  const lastTimeRef = useRef(0);
  const seekRef = useRef<(time: number) => void>(() => {});

  const save = useCallback((index: number, time: number) => {
    setProgress(book.slug, toStoredPosition(book, index, time));
  }, [book, setProgress]);

  const flushActivity = useCallback(() => {
    if (activityRef.current >= 1) {
      const stored = toStoredPosition(book, playbackRef.current.chapterIndex, currentTimeRef.current);
      recordActivity(book.slug, stored.chapterIndex, activityRef.current);
      activityRef.current = 0;
    }
  }, [book]);

  const play = useCallback(() => {
    const audio = getAudio();
    const source = audio.src;
    if (audio.error) {
      if (audio.currentTime > 0) pendingPositionRef.current = audio.currentTime;
      audio.load();
    }
    setError(null);
    void audio.play().catch((cause: unknown) => {
      if (audio.src !== source || (cause instanceof DOMException && cause.name === 'AbortError')) return;
      setIsPlaying(false);
      setError('Playback failed to start. Check your connection and try again.');
    });
  }, []);

  useEffect(() => {
    const audio = getAudio();
    const currentChapter = book.chapters[chapterIndex];
    const recordings = audioParts(currentChapter);
    const part = recordings[partIndex];
    if (!part) return;
    const start = recordings.slice(0, partIndex).reduce((sum, p) => sum + p.duration, 0);
    setError(null);
    setCurrentTime(start + (pendingPositionRef.current ?? 0));
    setDuration(currentChapter.duration);
    audio.src = part.audioUrl;
    audio.playbackRate = useStore.getState().playbackSpeed;
    const onLoadedMetadata = () => {
      if (recordings.length === 1 && Number.isFinite(audio.duration)) setDuration(audio.duration);
      const restore = pendingPositionRef.current;
      if (restore !== null && Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(restore, audio.duration));
      lastTimeRef.current = audio.currentTime;
      setCurrentTime(start + audio.currentTime);
      pendingPositionRef.current = null;
    };
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    if (autoplayRef.current) { autoplayRef.current = false; play(); }
    lastTimeRef.current = pendingPositionRef.current ?? 0;
    save(chapterIndex, start + (pendingPositionRef.current ?? 0));
    const next = recordings[partIndex + 1] ?? book.chapters[chapterIndex + 1]?.audioParts?.[0];
    if (next) precacheAudio(next.audioUrl);
    if ('mediaSession' in navigator) navigator.mediaSession.metadata = new MediaMetadata({
      title: currentChapter.title, artist: book.author, album: book.title,
      artwork: book.coverUrl ? [{ src: book.coverUrl, sizes: '512x512', type: 'image/jpeg' }] : [],
    });
    return () => audio.removeEventListener('loadedmetadata', onLoadedMetadata);
  }, [book, chapterIndex, partIndex, play, save]);

  useEffect(() => {
    const audio = getAudio();
    const onTimeUpdate = () => {
      if (audio.readyState === 0) return;
      const { chapterIndex: index, offset: start } = playbackRef.current;
      const localTime = audio.currentTime;
      const time = start + localTime;
      currentTimeRef.current = time;
      setCurrentTime(time);
      const delta = localTime - lastTimeRef.current;
      if (delta > 0 && delta < 3) activityRef.current += delta;
      lastTimeRef.current = localTime;
      if (activityRef.current >= 30) flushActivity();
      if (!audio.paused && Date.now() - lastSaveRef.current > 5000) {
        lastSaveRef.current = Date.now();
        save(index, time);
      }
    };
    const onPlay = () => { setIsPlaying(true); setError(null); };
    const onPause = () => {
      setIsPlaying(false);
      const p = playbackRef.current;
      save(p.chapterIndex, p.offset + (audio.readyState === 0 ? pendingPositionRef.current ?? 0 : audio.currentTime));
      flushActivity();
    };
    const onEnded = () => {
      flushActivity();
      const p = playbackRef.current;
      const recordings = audioParts(book.chapters[p.chapterIndex]);
      pendingPositionRef.current = 0;
      if (p.partIndex < recordings.length - 1) {
        autoplayRef.current = true;
        setPartIndex(p.partIndex + 1);
      } else if (p.chapterIndex < book.chapters.length - 1) {
        autoplayRef.current = true;
        setPartIndex(0);
        setChapterIndex(p.chapterIndex + 1);
      } else { markCompleted(book.slug); setIsPlaying(false); }
    };
    const onDurationChange = () => {
      if (audioParts(book.chapters[playbackRef.current.chapterIndex]).length === 1 && Number.isFinite(audio.duration) && audio.duration > 0)
        setDuration(audio.duration);
    };
    const onError = () => { if (audio.src) setError('Audio could not be loaded. Check your connection and try again.'); setIsPlaying(false); };
    const handlers = { timeupdate: onTimeUpdate, play: onPlay, pause: onPause, ended: onEnded, durationchange: onDurationChange, error: onError };
    for (const [event, handler] of Object.entries(handlers)) audio.addEventListener(event, handler);
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', play);
      navigator.mediaSession.setActionHandler('pause', () => audio.pause());
      navigator.mediaSession.setActionHandler('seekbackward', () => seekRef.current(currentTimeRef.current - 15));
      navigator.mediaSession.setActionHandler('seekforward', () => seekRef.current(currentTimeRef.current + 15));
    }
    return () => {
      if (audio.readyState > 0) save(playbackRef.current.chapterIndex, playbackRef.current.offset + audio.currentTime);
      flushActivity();
      // Detach before pause/load so teardown cannot overwrite the saved position.
      for (const [event, handler] of Object.entries(handlers)) audio.removeEventListener(event, handler);
      audio.pause(); audio.removeAttribute('src'); audio.load();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        for (const action of ['play', 'pause', 'seekbackward', 'seekforward'] as const) navigator.mediaSession.setActionHandler(action, null);
      }
    };
  }, [book, flushActivity, markCompleted, play, save]);

  // Native timeupdate can arrive only four times a second. Refresh the visible
  // position more often while playing so short words highlight on time.
  useEffect(() => {
    if (!isPlaying) return;
    const audio = getAudio();
    let frame = 0;
    let lastFrame = 0;
    const update = (now: number) => {
      if (now - lastFrame >= 50 && !audio.paused && audio.readyState > 0) {
        lastFrame = now;
        setCurrentTime(playbackRef.current.offset + audio.currentTime);
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [isPlaying]);

  const select = useCallback((index: number, time: number, autoplay: boolean) => {
    const located = locateAudioPart(book.chapters[index], time);
    const current = playbackRef.current;
    const audio = getAudio();
    pendingPositionRef.current = located.position;
    lastTimeRef.current = located.position;
    currentTimeRef.current = located.offset + located.position;
    setCurrentTime(currentTimeRef.current);
    save(index, currentTimeRef.current);
    if (index === current.chapterIndex && located.index === current.partIndex) {
      if (audio.readyState > 0) { audio.currentTime = located.position; pendingPositionRef.current = null; }
      if (autoplay) play(); else audio.pause();
    } else {
      flushActivity();
      autoplayRef.current = autoplay;
      setPartIndex(located.index); setChapterIndex(index);
    }
  }, [book, flushActivity, play, save]);

  const seek = useCallback((time: number) => {
    if (!Number.isFinite(time)) return;
    select(playbackRef.current.chapterIndex, Math.max(0, Math.min(time, duration)), !getAudio().paused);
  }, [duration, select]);
  seekRef.current = seek;
  const setChapter = useCallback((index: number, opts?: { autoplay?: boolean; position?: number }) => {
    if (!Number.isInteger(index) || index < 0 || index >= book.chapters.length) return;
    select(index, opts?.position ?? 0, opts?.autoplay ?? !getAudio().paused);
  }, [book.chapters.length, select]);
  const toggle = useCallback(() => { const audio = getAudio(); if (audio.paused || audio.error) play(); else audio.pause(); }, [play]);
  const skip = useCallback((delta: number) => seek(currentTimeRef.current + delta), [seek]);
  const next = useCallback(() => setChapter(chapterIndex + 1), [chapterIndex, setChapter]);
  const prev = useCallback(() => setChapter(chapterIndex - 1), [chapterIndex, setChapter]);
  const setSpeed = useCallback((value: PlaybackSpeed) => { setPlaybackSpeed(value); getAudio().playbackRate = value; }, [setPlaybackSpeed]);
  return { chapterIndex, isPlaying, currentTime, duration, error, speed, toggle, seek, skip, setChapter, next, prev, setSpeed };
}
