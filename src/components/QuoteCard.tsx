import { useEffect, useState } from 'react';
import type { Book } from '../data/types';
import { OwlLogo } from './OwlLogo';
import { CheckIcon, DownloadIcon, ShareIcon, XIcon } from './icons';

interface QuoteCardProps {
  book: Book;
  quote: string;
  onClose: () => void;
}

const OWL_BODY =
  'M64 118 C34 118 20 96 20 66 C20 46 28 32 24 16 C36 26 44 24 64 24 C84 24 92 26 104 16 C100 32 108 46 108 66 C108 96 94 118 64 118 Z';

/** Render the quote card to a canvas (1080×1350, share-friendly). */
async function renderQuoteImage(book: Book, quote: string): Promise<Blob | null> {
  await Promise.all([
    document.fonts.load('600 56px "Playfair Display"'),
    document.fonts.load('italic 400 44px "Lora"'),
    document.fonts.load('400 30px "Lora"'),
  ]).catch(() => undefined);

  const W = 1080;
  const H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#1C1C1E';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(184, 150, 62, 0.5)';
  ctx.lineWidth = 2;
  ctx.strokeRect(50, 50, W - 100, H - 100);

  // Big decorative quotation mark
  ctx.fillStyle = '#B8963E';
  ctx.font = '600 160px "Playfair Display", Georgia, serif';
  ctx.fillText('“', 100, 260);

  // Quote body — shrink font until it fits
  const maxWidth = W - 240;
  let fontSize = 52;
  let lines: string[] = [];
  const clipped = quote.length > 420 ? `${quote.slice(0, 420).trimEnd()}…` : quote;
  do {
    ctx.font = `italic 400 ${fontSize}px "Lora", Georgia, serif`;
    lines = wrapText(ctx, clipped, maxWidth);
    if (lines.length * fontSize * 1.5 <= 720) break;
    fontSize -= 4;
  } while (fontSize > 26);

  ctx.fillStyle = '#F5F0E8';
  const lineHeight = fontSize * 1.5;
  const textBlockHeight = lines.length * lineHeight;
  let y = Math.max(330, (H - 300 - textBlockHeight) / 2 + 100);
  for (const line of lines) {
    ctx.fillText(line, 120, y);
    y += lineHeight;
  }

  // Attribution
  ctx.fillStyle = '#B8963E';
  ctx.fillRect(120, H - 280, 64, 3);
  ctx.font = '600 44px "Playfair Display", Georgia, serif';
  ctx.fillStyle = '#F5F0E8';
  ctx.fillText(book.title, 120, H - 210);
  ctx.font = '400 32px "Lora", Georgia, serif';
  ctx.fillStyle = '#8E8E93';
  ctx.fillText(book.author, 120, H - 158);

  // Brand mark
  ctx.save();
  ctx.translate(W - 220, H - 250);
  ctx.scale(0.9, 0.9);
  ctx.fillStyle = '#2C2C2E';
  ctx.fill(new Path2D(OWL_BODY));
  ctx.fillStyle = '#F5F0E8';
  circle(ctx, 46, 60, 17);
  circle(ctx, 82, 60, 17);
  ctx.fillStyle = '#B8963E';
  circle(ctx, 46, 60, 8.5);
  circle(ctx, 82, 60, 8.5);
  ctx.fillStyle = '#1C1C1E';
  circle(ctx, 46, 60, 3.5);
  circle(ctx, 82, 60, 3.5);
  ctx.fillStyle = '#B8963E';
  ctx.fill(new Path2D('M64 74 L57 83 L64 94 L71 83 Z'));
  ctx.restore();
  ctx.font = '400 26px -apple-system, "Segoe UI", sans-serif';
  ctx.fillStyle = '#8E8E93';
  ctx.fillText('Ausculto', W - 226, H - 108);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function QuoteCard({ book, quote, onClose }: QuoteCardProps) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const display = quote.length > 420 ? `${quote.slice(0, 420).trimEnd()}…` : quote;

  const copyImage = async () => {
    setBusy(true);
    try {
      const blob = await renderQuoteImage(book, quote);
      if (blob && navigator.clipboard && 'write' in navigator.clipboard) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      } else {
        await navigator.clipboard.writeText(`“${display}”\n— ${book.title}, ${book.author}`);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard denied */
    } finally {
      setBusy(false);
    }
  };

  const downloadImage = async () => {
    setBusy(true);
    try {
      const blob = await renderQuoteImage(book, quote);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ausculto-${book.slug}-quote.png`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    const text = `“${display}”\n— ${book.title}, ${book.author}`;
    try {
      const blob = await renderQuoteImage(book, quote);
      if (blob) {
        const file = new File([blob], 'ausculto-quote.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], text });
          return;
        }
      }
      if (navigator.share) {
        await navigator.share({ text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Share quote"
    >
      <div
        className="w-full max-w-md animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Preview card */}
        <div className="relative rounded-2xl border border-gold/50 bg-charcoal p-8 shadow-pop">
          <span className="font-display text-6xl leading-none text-gold" aria-hidden="true">
            “
          </span>
          <blockquote className="mt-2 font-body text-lg italic leading-relaxed text-parchment">
            {display}
          </blockquote>
          <div className="mt-6">
            <span className="block h-0.5 w-12 bg-gold" aria-hidden="true" />
            <p className="mt-3 font-display text-lg font-semibold text-parchment">{book.title}</p>
            <p className="font-body text-sm text-dim" style={{ color: '#8E8E93' }}>
              {book.author}
            </p>
          </div>
          <div className="absolute bottom-6 right-6 flex flex-col items-center gap-1 opacity-80">
            <OwlLogo size={34} />
            <span className="text-[11px]" style={{ color: '#8E8E93' }}>
              Ausculto
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center justify-center gap-2">
          <button
            onClick={() => void copyImage()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-gold px-3.5 py-2 text-sm font-semibold text-charcoal hover:bg-gold-bright disabled:opacity-60"
          >
            {copied ? <CheckIcon size={15} /> : null}
            {copied ? 'Copied' : 'Copy as image'}
          </button>
          <button
            onClick={() => void downloadImage()}
            disabled={busy}
            aria-label="Download image"
            className="flex items-center gap-1.5 rounded-lg border border-edge bg-surface px-3.5 py-2 text-sm hover:border-gold disabled:opacity-60"
          >
            <DownloadIcon size={15} />
          </button>
          <button
            onClick={() => void share()}
            disabled={busy}
            aria-label="Share quote"
            className="flex items-center gap-1.5 rounded-lg border border-edge bg-surface px-3.5 py-2 text-sm hover:border-gold disabled:opacity-60"
          >
            <ShareIcon size={15} />
          </button>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex items-center rounded-lg border border-edge bg-surface p-2 text-muted hover:text-ink"
          >
            <XIcon size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
