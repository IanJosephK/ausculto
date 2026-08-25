export interface Chapter {
  title: string;
  audioUrl: string;
  /** Seconds */
  duration: number;
}

export interface Book {
  slug: string;
  title: string;
  author: string;
  year: number;
  genre: string;
  description: string;
  coverUrl?: string;
  gutenbergId: number;
  librivoxId: number;
  librivoxUrl?: string;
  /** Seconds, whole book */
  totalDuration: number;
  /** How chapter text was mapped to audio sections by the prep script */
  textMapping: string;
  chapters: Chapter[];
}

/** Lazy-loaded per-chapter text, served from /books/{slug}/{index}.json */
export interface ChapterText {
  title: string;
  paragraphs: string[];
  /**
   * Italic char ranges per paragraph, [start, end] into each clean paragraph
   * string (Gutenberg underscore-emphasis, re-applied as <em> at render).
   * Aligned by index with `paragraphs`; absent on pre-migration data.
   */
  italics?: [number, number][][];
}

/** One aligned word from src/data/alignments/{slug}/{index}.json */
export interface WordTiming {
  word: string;
  /** Seconds into the chapter audio */
  start: number;
  end: number;
}

export interface Highlight {
  id: string;
  bookSlug: string;
  chapterIndex: number;
  /** Character offsets into the chapter's plain text (paragraphs joined with \n\n) */
  startOffset: number;
  endOffset: number;
  text: string;
  note: string | null;
  createdAt: number;
}

export interface Bookmark {
  id: string;
  bookSlug: string;
  chapterIndex: number;
  createdAt: number;
}

export interface BookProgress {
  chapterIndex: number;
  /** Seconds into the current chapter's audio */
  position: number;
  updatedAt: number;
}
