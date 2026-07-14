import type { Book } from '../data/types';
import type { AudioPlayer as PlayerState } from '../hooks/useAudioPlayer';
import { PLAYBACK_SPEEDS } from '../store/useStore';
import { formatTime } from '../lib/format';
import { NextIcon, PauseIcon, PlayIcon, PrevIcon, SkipBackIcon, SkipForwardIcon } from './icons';

interface AudioPlayerBarProps {
  book: Book;
  player: PlayerState;
}

export function AudioPlayerBar({ book, player }: AudioPlayerBarProps) {
  const chapter = book.chapters[player.chapterIndex];
  const pct = player.duration > 0 ? (player.currentTime / player.duration) * 100 : 0;

  const cycleSpeed = () => {
    const i = PLAYBACK_SPEEDS.indexOf(player.speed);
    player.setSpeed(PLAYBACK_SPEEDS[(i + 1) % PLAYBACK_SPEEDS.length]);
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 border-t border-edge bg-surface/95 shadow-player backdrop-blur-md"
      role="region"
      aria-label="Audio player"
    >
      {player.error && (
        <p className="border-b border-edge bg-red-950/40 px-4 py-1.5 text-center text-xs text-red-300">
          {player.error}
        </p>
      )}
      <div className="mx-auto max-w-6xl px-4 pb-3 pt-2">
        {/* Scrubber */}
        <div className="flex items-center gap-3">
          <span className="w-12 text-right font-ui text-xs tabular-nums text-muted">
            {formatTime(player.currentTime)}
          </span>
          <input
            type="range"
            className="scrubber flex-1"
            min={0}
            max={Math.max(1, Math.floor(player.duration))}
            step={1}
            value={Math.floor(player.currentTime)}
            style={{ '--scrub-pct': `${pct}%` } as React.CSSProperties}
            onChange={(e) => player.seek(Number(e.target.value))}
            aria-label={`Seek within ${chapter?.title ?? 'chapter'}`}
            aria-valuetext={`${formatTime(player.currentTime)} of ${formatTime(player.duration)}`}
          />
          <span className="w-12 font-ui text-xs tabular-nums text-muted">
            {formatTime(player.duration)}
          </span>
        </div>

        {/* Title + controls */}
        <div className="mt-1.5 flex items-center gap-2">
          <div className="hidden min-w-0 flex-1 sm:block">
            <p className="truncate text-sm font-medium">{chapter?.title}</p>
            <p className="truncate text-xs text-muted">
              {book.title} · Chapter {player.chapterIndex + 1} of {book.chapters.length}
            </p>
          </div>

          <div className="flex flex-1 items-center justify-center gap-1 sm:gap-2">
            <button
              onClick={player.prev}
              disabled={player.chapterIndex === 0}
              aria-label="Previous chapter"
              className="rounded-full p-2 text-muted transition-colors hover:text-ink disabled:opacity-30"
            >
              <PrevIcon size={20} />
            </button>
            <button
              onClick={() => player.skip(-15)}
              aria-label="Back 15 seconds"
              className="rounded-full p-2 text-ink transition-colors hover:text-gold"
            >
              <SkipBackIcon size={24} />
            </button>
            <button
              onClick={player.toggle}
              aria-label={player.isPlaying ? 'Pause' : 'Play'}
              className="mx-1 flex h-12 w-12 items-center justify-center rounded-full bg-gold text-charcoal shadow-card transition-all hover:bg-gold-bright hover:shadow-card-hover"
            >
              {player.isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} className="ml-0.5" />}
            </button>
            <button
              onClick={() => player.skip(15)}
              aria-label="Forward 15 seconds"
              className="rounded-full p-2 text-ink transition-colors hover:text-gold"
            >
              <SkipForwardIcon size={24} />
            </button>
            <button
              onClick={player.next}
              disabled={player.chapterIndex >= book.chapters.length - 1}
              aria-label="Next chapter"
              className="rounded-full p-2 text-muted transition-colors hover:text-ink disabled:opacity-30"
            >
              <NextIcon size={20} />
            </button>
          </div>

          <div className="flex flex-1 items-center justify-end">
            <button
              onClick={cycleSpeed}
              aria-label={`Playback speed ${player.speed}×, click to change`}
              className="rounded-lg border border-edge px-2.5 py-1 font-ui text-xs font-semibold tabular-nums text-muted transition-colors hover:border-gold hover:text-gold"
            >
              {player.speed}×
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
