import { useCallback, useRef, useState } from 'react';
import Fuse, { type FuseResult } from 'fuse.js';
import type { Book } from '../data/types';
import { loadAllChapterTexts } from '../lib/textLoader';

export interface SearchEntry {
  chapterIndex: number;
  chapterTitle: string;
  paragraphIndex: number;
  text: string;
}

export interface SearchResultGroup {
  chapterIndex: number;
  chapterTitle: string;
  matches: FuseResult<SearchEntry>[];
}

// One index per book, kept for the session
const indexCache = new Map<string, Promise<Fuse<SearchEntry>>>();

function getIndex(book: Book): Promise<Fuse<SearchEntry>> {
  let cached = indexCache.get(book.slug);
  if (!cached) {
    cached = loadAllChapterTexts(book).then((chapters) => {
      const entries: SearchEntry[] = [];
      chapters.forEach((chapter, chapterIndex) => {
        chapter.paragraphs.forEach((text, paragraphIndex) => {
          entries.push({
            chapterIndex,
            chapterTitle: book.chapters[chapterIndex]?.title ?? chapter.title,
            paragraphIndex,
            text,
          });
        });
      });
      return new Fuse(entries, {
        keys: ['text'],
        includeMatches: true,
        includeScore: true,
        threshold: 0.3,
        ignoreLocation: true,
        minMatchCharLength: 3,
      });
    });
    cached.catch(() => indexCache.delete(book.slug));
    indexCache.set(book.slug, cached);
  }
  return cached;
}

export function useBookSearch(book: Book) {
  const [results, setResults] = useState<SearchResultGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const [indexing, setIndexing] = useState(false);
  const queryIdRef = useRef(0);

  const search = useCallback(
    async (query: string) => {
      const id = ++queryIdRef.current;
      const trimmed = query.trim();
      if (trimmed.length < 3) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      if (!indexCache.has(book.slug)) setIndexing(true);
      try {
        const fuse = await getIndex(book);
        if (id !== queryIdRef.current) return; // superseded
        const hits = fuse.search(trimmed, { limit: 60 });
        const groups = new Map<number, SearchResultGroup>();
        for (const hit of hits) {
          let group = groups.get(hit.item.chapterIndex);
          if (!group) {
            group = {
              chapterIndex: hit.item.chapterIndex,
              chapterTitle: hit.item.chapterTitle,
              matches: [],
            };
            groups.set(hit.item.chapterIndex, group);
          }
          if (group.matches.length < 8) group.matches.push(hit);
        }
        setResults([...groups.values()].sort((a, b) => a.chapterIndex - b.chapterIndex));
      } finally {
        if (id === queryIdRef.current) {
          setSearching(false);
          setIndexing(false);
        }
      }
    },
    [book],
  );

  const clear = useCallback(() => {
    queryIdRef.current++;
    setResults([]);
    setSearching(false);
  }, []);

  return { results, searching, indexing, search, clear };
}
