import { createHash } from 'node:crypto';
import type { AudioPart, Book, ChapterText } from '../src/data/types';
import { extractSections } from './book-text';
import { parseItalics } from './italics';

export interface BookMapping extends Omit<Book, 'chapters' | 'textMapping' | 'totalDuration'> {
  source: { url: string; sha256: string; cacheFile: string; credit?: string };
  legacyCount: number;
  chapters: { id: string; title: string; textSections: string[]; audioParts: AudioPart[] }[];
  excludedAudio: (AudioPart & { reason: string; targetTextSection: string })[];
}

export function prepareBook(spec: BookMapping, raw: string): { book: Book; texts: ChapterText[] } {
  const digest = createHash('sha256').update(raw).digest('hex');
  if (digest !== spec.source.sha256) throw new Error(`${spec.slug}: source changed; review its edition and mapping before updating its hash`);
  const sections = extractSections(spec.slug, raw);
  const byId = new Map(sections.map(s => [s.id, s]));
  const used = new Set<string>();
  const audioIds = new Set<string>();
  const legacy: NonNullable<Book['legacyChapters']> = [];
  const texts: ChapterText[] = [];
  const chapters = spec.chapters.map((c, chapterIndex) => {
    if (!c.audioParts.length || !c.textSections.length) throw new Error(`${spec.slug}/${c.id}: missing audio/text`);
    const rawParagraphs = c.textSections.flatMap((id, index) => {
      const section = byId.get(id);
      if (!section || used.has(id)) throw new Error(`${spec.slug}: missing or duplicate text section ${id}`);
      used.add(id);
      return [...(index ? [section.title] : []), ...section.paragraphs];
    });
    const parsed = rawParagraphs.filter(Boolean).map(parseItalics);
    if (!parsed.length) throw new Error(`${spec.slug}/${c.id}: empty text`);
    texts.push({ title: c.title, paragraphs: parsed.map(p => p.text), italics: parsed.map(p => p.italics) });
    let duration = 0;
    for (const part of c.audioParts) {
      if (audioIds.has(part.id) || !Number.isFinite(part.duration) || part.duration <= 0 || legacy[part.legacyIndex])
        throw new Error(`${spec.slug}: invalid/duplicate audio part ${part.id}`);
      audioIds.add(part.id);
      legacy[part.legacyIndex] = { chapterIndex, offset: duration };
      duration += part.duration;
    }
    return { ...c, audioUrl: c.audioParts[0].audioUrl, duration };
  });
  if (used.size !== sections.length) throw new Error(`${spec.slug}: unmapped story text: ${sections.filter(s => !used.has(s.id)).map(s => s.id).join(', ')}`);
  for (const excluded of spec.excludedAudio) {
    const chapterIndex = chapters.findIndex(c => c.textSections.includes(excluded.targetTextSection));
    if (chapterIndex < 0 || legacy[excluded.legacyIndex] || audioIds.has(excluded.id)) throw new Error(`${spec.slug}: invalid excluded recording`);
    audioIds.add(excluded.id);
    legacy[excluded.legacyIndex] = {
      chapterIndex, offset: 0,
      scale: excluded.reason === 'alternate' ? chapters[chapterIndex].duration / excluded.duration : 0,
    };
  }
  if (legacy.length !== spec.legacyCount || Array.from({ length: spec.legacyCount }, (_, i) => legacy[i]).some(m => !m))
    throw new Error(`${spec.slug}: missing legacy recording migration`);
  const revision = createHash('sha256').update(JSON.stringify({ texts, chapters })).digest('hex').slice(0, 16);
  const { source, excludedAudio: _excluded, legacyCount: _count, ...metadata } = spec;
  return {
    book: {
      ...metadata, chapters, legacyChapters: legacy,
      totalDuration: chapters.reduce((sum, c) => sum + c.duration, 0),
      textMapping: chapters.some(c => c.audioParts.length > 1) ? 'multipart' : chapters.some(c => c.textSections.length > 1) ? 'grouped' : 'exact',
      textRevision: revision,
      textSource: { url: source.url, sha256: source.sha256, ...(source.credit ? { credit: source.credit } : {}) },
    }, texts,
  };
}
