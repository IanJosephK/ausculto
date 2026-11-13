import type { Book } from '../data/types';
import { readAlongForBook } from '../lib/readAlong';
import { CheckIcon } from './icons';

export function ReadAlongBadge({ book }: { book: Book }) {
  if (!readAlongForBook(book)) return null;
  return (
    <span className="mt-1.5 inline-flex self-start items-center gap-1 rounded-full border border-gold/30 bg-gold-faint px-2 py-0.5 text-[10px] font-medium leading-tight text-gold"
      title="Follow the highlighted words as you listen. Available throughout this book.">
      <CheckIcon size={12} /> Read-along synced
    </span>
  );
}
