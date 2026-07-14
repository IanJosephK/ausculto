import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PencilIcon, QuoteIcon, TrashIcon } from './icons';

export type PopoverAction = 'highlight' | 'note' | 'quote' | 'remove';

interface HighlightPopoverProps {
  /** Container-relative anchor */
  x: number;
  y: number;
  /** New selection vs. an existing highlight */
  mode: 'new' | 'existing';
  existingNote?: string | null;
  onHighlight?: () => void;
  onSaveNote: (content: string) => void;
  onQuote: () => void;
  onRemove?: () => void;
  onClose: () => void;
}

export function HighlightPopover({
  x,
  y,
  mode,
  existingNote,
  onHighlight,
  onSaveNote,
  onQuote,
  onRemove,
  onClose,
}: HighlightPopoverProps) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState(existingNote ?? '');
  const ref = useRef<HTMLDivElement>(null);

  // Keep the (center-anchored) popover inside its positioning container
  const [left, setLeft] = useState(() => Math.max(90, x));
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.offsetParent as HTMLElement | null;
    if (!el || !parent) return;
    const half = el.offsetWidth / 2 + 8;
    setLeft(Math.max(half, Math.min(x, parent.clientWidth - half)));
  }, [x, noteOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    const onDocDown = (e: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('touchstart', onDocDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('touchstart', onDocDown);
    };
  }, [onClose]);

  const btn =
    'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-surface2';

  return (
    <div
      ref={ref}
      role="menu"
      aria-label={mode === 'new' ? 'Selection actions' : 'Highlight actions'}
      className="absolute z-30 -translate-x-1/2 -translate-y-full animate-fade-in pb-2"
      style={{ left, top: Math.max(40, y) }}
      onMouseUp={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <div className="rounded-xl border border-edge bg-surface shadow-pop">
        {!noteOpen ? (
          <div className="flex items-center p-1">
            {mode === 'new' && (
              <button role="menuitem" className={`${btn} text-gold`} onClick={onHighlight}>
                <span className="inline-block h-3 w-3 rounded-sm bg-gold" aria-hidden="true" />
                Highlight
              </button>
            )}
            <button role="menuitem" className={btn} onClick={() => setNoteOpen(true)}>
              <PencilIcon size={14} />
              {mode === 'existing' && existingNote ? 'Edit note' : 'Add note'}
            </button>
            <button role="menuitem" className={btn} onClick={onQuote}>
              <QuoteIcon size={14} />
              Quote
            </button>
            {mode === 'existing' && (
              <button role="menuitem" className={`${btn} text-red-400`} onClick={onRemove}>
                <TrashIcon size={14} />
                Remove
              </button>
            )}
          </div>
        ) : (
          <div className="w-64 p-2">
            <textarea
              autoFocus
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Your note…"
              rows={3}
              className="w-full resize-none rounded-lg border border-edge bg-page p-2 font-body text-sm outline-none focus:border-gold"
            />
            <div className="mt-1.5 flex justify-end gap-1.5">
              <button
                className="rounded-lg px-2.5 py-1 text-xs text-muted hover:text-ink"
                onClick={() => setNoteOpen(false)}
              >
                Cancel
              </button>
              <button
                className="rounded-lg bg-gold px-2.5 py-1 text-xs font-semibold text-charcoal hover:bg-gold-bright"
                onClick={() => onSaveNote(note.trim())}
              >
                Save note
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
