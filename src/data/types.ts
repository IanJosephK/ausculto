export interface AudioPart {
  id: string;
  audioUrl: string;
  duration: number;
  /** Stable index used by existing guest/cloud progress and bookmarks. */
  legacyIndex: number;
}

export interface Chapter {
  title: string;
  audioUrl: string;
  /** Seconds */
  duration: number;
  id?: string;
  audioParts?: AudioPart[];
  textSections?: string[];
}

export interface Book {
  slug: string;
  title: string;
  author: string;
  year: number;
  genre: string;
  description: string;
  coverUrl?: string;
  gutenbergId?: number;
  librivoxId: number;
  librivoxUrl?: string;
  /** Seconds, whole book */
  totalDuration: number;
  /** How chapter text was mapped to audio sections by the prep script */
  textMapping: string;
  textRevision?: string;
  textSource?: { url: string; sha256: string; credit?: string };
  /** Structural match ordering, not a percentage of word-level accuracy. */
  matchRank?: number;
  /** Old recording indices -> current chapter and cumulative audio offset. */
  legacyChapters?: { chapterIndex: number; offset: number; scale?: number }[];
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

/** One aligned word from a versioned /alignments/{slug}/ chapter asset. */
export interface WordTiming {
  word: string;
  /** Seconds into the chapter audio */
  start: number;
  end: number;
  /** UTF-16 offsets in the displayed paragraphs joined with two newlines. */
  startOffset: number;
  endOffset: number;
}

export interface ChapterAlignment {
  version: 1;
  textRevision: string;
  chapterId: string;
  audioUrls: string[];
  model: string;
  coverage: number;
  words: WordTiming[];
}

export interface ReadAlongBook {
  textRevision: string;
  chapters: { id: string; audioUrls: string[]; url: string; coverage: number }[];
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
  /** Retain saved excerpts/notes that cannot safely be located in a new edition. */
  unresolved?: boolean;
  /** Present for new local/session annotations; older cloud rows have no revision. */
  textRevision?: string;
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
