/**
 * prepare-books.ts
 *
 * Fetches audio metadata from the LibriVox API and full text from Project
 * Gutenberg for every book in the curated list below, then writes:
 *
 *   - public/books/{slug}/{chapterIndex}.json   — per-chapter text ({ title, paragraphs })
 *   - src/data/books.generated.json             — book + chapter metadata the app imports
 *
 * Chapters in the app mirror LibriVox audio sections. Text is mapped to them
 * one of two ways:
 *   1. "exact"        — Gutenberg heading count matches the section count → 1:1.
 *   2. "proportional" — otherwise paragraphs are distributed across sections
 *                       in proportion to each section's audio playtime.
 *
 * Run with: npm run prepare-books [-- slug1 slug2 ...]
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

interface CuratedBook {
  slug: string;
  title: string;
  author: string;
  authorLastName: string;
  year: number;
  genre: string;
  description: string;
  gutenbergId: number;
  /** Search string for the LibriVox API (it indexes titles without leading articles). */
  librivoxQuery: string;
  /** Pin a specific LibriVox recording id, skipping the search heuristic. */
  librivoxId?: number;
}

const CURATED: CuratedBook[] = [
  {
    slug: 'pride-and-prejudice',
    title: 'Pride and Prejudice',
    author: 'Jane Austen',
    authorLastName: 'Austen',
    year: 1813,
    genre: 'Fiction',
    description:
      'Elizabeth Bennet spars with the proud Mr. Darcy in Regency England, where wit is a weapon and marriage a market. Austen’s most beloved novel is a sharp, funny study of first impressions and second chances.',
    gutenbergId: 1342,
    librivoxQuery: 'pride and prejudice',
  },
  {
    slug: 'jane-eyre',
    title: 'Jane Eyre',
    author: 'Charlotte Brontë',
    authorLastName: 'Brontë',
    year: 1847,
    genre: 'Fiction',
    description:
      'An orphaned governess with a fierce sense of self falls for her brooding employer, Mr. Rochester — whose house holds a terrible secret. A gothic romance and a quietly radical portrait of a woman insisting on her own worth.',
    gutenbergId: 1260,
    librivoxQuery: 'jane eyre',
  },
  {
    slug: 'the-great-gatsby',
    title: 'The Great Gatsby',
    author: 'F. Scott Fitzgerald',
    authorLastName: 'Fitzgerald',
    year: 1925,
    genre: 'Fiction',
    description:
      'Across the bay from Daisy Buchanan’s green light, the mysterious Jay Gatsby throws glittering parties for a dream that has already slipped away. Fitzgerald’s jazz-age tragedy of longing and reinvention.',
    gutenbergId: 64317,
    librivoxQuery: 'great gatsby',
  },
  {
    slug: 'a-tale-of-two-cities',
    title: 'A Tale of Two Cities',
    author: 'Charles Dickens',
    authorLastName: 'Dickens',
    year: 1859,
    genre: 'Fiction',
    description:
      'London and Paris, the best of times and the worst, as the French Revolution gathers to a storm. Dickens’ tale of sacrifice and resurrection builds to one of the most famous endings in literature.',
    gutenbergId: 98,
    librivoxQuery: 'tale of two cities',
  },
  {
    slug: 'frankenstein',
    title: 'Frankenstein',
    author: 'Mary Shelley',
    authorLastName: 'Shelley',
    year: 1818,
    genre: 'Horror & Gothic',
    description:
      'A young scientist assembles a living being from dead matter — then abandons it. Shelley’s creature, eloquent and unloved, pursues his maker across the ice in the novel that invented science fiction.',
    gutenbergId: 84,
    librivoxQuery: 'frankenstein, or the modern prometheus',
  },
  {
    slug: 'dracula',
    title: 'Dracula',
    author: 'Bram Stoker',
    authorLastName: 'Stoker',
    year: 1897,
    genre: 'Horror & Gothic',
    description:
      'Told in letters, diaries, and news clippings, an ancient vampire moves from his Transylvanian castle to the heart of London. Stoker’s masterpiece of creeping dread defined the vampire for every story that followed.',
    gutenbergId: 345,
    librivoxQuery: 'dracula',
  },
  {
    slug: 'jekyll-and-hyde',
    title: 'The Strange Case of Dr. Jekyll and Mr. Hyde',
    author: 'Robert Louis Stevenson',
    authorLastName: 'Stevenson',
    year: 1886,
    genre: 'Horror & Gothic',
    description:
      'A respectable London doctor and a violent stranger share more than an address. Stevenson’s taut novella about the divided self gave the language a permanent shorthand for the monster within.',
    gutenbergId: 43,
    librivoxQuery: 'strange case of dr. jekyll and mr. hyde',
  },
  {
    slug: 'sherlock-holmes',
    title: 'The Adventures of Sherlock Holmes',
    author: 'Arthur Conan Doyle',
    authorLastName: 'Doyle',
    year: 1892,
    genre: 'Mystery & Adventure',
    description:
      'Twelve cases from 221B Baker Street, from “A Scandal in Bohemia” to “The Speckled Band.” Doyle’s detective at his sharpest — observing everything, forgiving nothing, narrated by the ever-loyal Dr. Watson.',
    gutenbergId: 1661,
    librivoxQuery: 'adventures of sherlock holmes',
  },
  {
    slug: 'count-of-monte-cristo',
    title: 'The Count of Monte Cristo',
    author: 'Alexandre Dumas',
    authorLastName: 'Dumas',
    year: 1844,
    genre: 'Mystery & Adventure',
    description:
      'Betrayed on his wedding day and buried alive in an island prison, Edmond Dantès escapes with a fortune and a plan. Dumas’ sprawling epic of patience and revenge is the ultimate long listen.',
    gutenbergId: 1184,
    librivoxQuery: 'count of monte cristo',
  },
  {
    slug: 'treasure-island',
    title: 'Treasure Island',
    author: 'Robert Louis Stevenson',
    authorLastName: 'Stevenson',
    year: 1883,
    genre: 'Mystery & Adventure',
    description:
      'A map, a mutiny, and a one-legged cook named Long John Silver. Stevenson’s adventure set the template for every pirate story since — and remains the best of them.',
    gutenbergId: 120,
    librivoxQuery: 'treasure island',
  },
  {
    slug: 'the-time-machine',
    title: 'The Time Machine',
    author: 'H. G. Wells',
    authorLastName: 'Wells',
    year: 1895,
    genre: 'Sci-Fi & Fantasy',
    description:
      'A Victorian inventor hurls himself eight hundred thousand years into the future and finds humanity split into the gentle Eloi and the subterranean Morlocks. The book that popularized time travel.',
    gutenbergId: 35,
    librivoxQuery: 'time machine',
  },
  {
    slug: 'twenty-thousand-leagues',
    title: 'Twenty Thousand Leagues Under the Sea',
    author: 'Jules Verne',
    authorLastName: 'Verne',
    year: 1870,
    genre: 'Sci-Fi & Fantasy',
    description:
      'Aboard the submarine Nautilus, the enigmatic Captain Nemo tours the wonders and terrors of the deep. Verne’s undersea odyssey imagined technology decades before it existed.',
    gutenbergId: 164,
    librivoxQuery: 'twenty thousand leagues under the sea',
  },
  {
    slug: 'alice-in-wonderland',
    title: "Alice's Adventures in Wonderland",
    author: 'Lewis Carroll',
    authorLastName: 'Carroll',
    year: 1865,
    genre: 'Sci-Fi & Fantasy',
    description:
      'Down the rabbit hole, logic bends: a grinning cat, a mad tea party, a queen who shouts “Off with their heads!” Carroll’s dream-logic classic delights at any age.',
    gutenbergId: 11,
    librivoxQuery: "alice's adventures in wonderland",
  },
  {
    slug: 'meditations',
    title: 'Meditations',
    author: 'Marcus Aurelius',
    authorLastName: 'Aurelius',
    year: 180,
    genre: 'Philosophy',
    description:
      'The private notebook of a Roman emperor, never meant for publication. Two thousand years later, its Stoic counsel on anger, mortality, and duty still reads like advice from a wise friend.',
    gutenbergId: 2680,
    librivoxQuery: 'meditations',
  },
  {
    slug: 'the-art-of-war',
    title: 'The Art of War',
    author: 'Sun Tzu',
    authorLastName: 'Sun',
    year: -500,
    genre: 'Philosophy',
    description:
      'Thirteen chapters on strategy, deception, and knowing when not to fight, written in China two and a half millennia ago. Still assigned in boardrooms and war colleges alike.',
    gutenbergId: 132,
    librivoxQuery: 'art of war',
  },
  {
    slug: 'walden',
    title: 'Walden',
    author: 'Henry David Thoreau',
    authorLastName: 'Thoreau',
    year: 1854,
    genre: 'Philosophy',
    description:
      'Two years in a cabin by a pond, recorded by a man determined to “live deliberately.” Thoreau’s experiment in simplicity is part memoir, part manifesto, part field notebook.',
    gutenbergId: 205,
    librivoxQuery: 'walden',
  },
  {
    slug: 'metamorphosis',
    title: 'Metamorphosis',
    author: 'Franz Kafka',
    authorLastName: 'Kafka',
    year: 1915,
    genre: 'Novellas',
    description:
      'Gregor Samsa wakes from uneasy dreams to find himself transformed into a monstrous insect — and his family transformed with him. Kafka’s novella of alienation, told with terrible calm.',
    gutenbergId: 5200,
    librivoxQuery: 'metamorphosis',
  },
  {
    slug: 'dorian-gray',
    title: 'The Picture of Dorian Gray',
    author: 'Oscar Wilde',
    authorLastName: 'Wilde',
    year: 1890,
    genre: 'Novellas',
    description:
      'A beautiful young man keeps his youth while his portrait ages and corrupts in the attic. Wilde’s only novel is gothic horror delivered in flawless epigrams.',
    gutenbergId: 174,
    librivoxQuery: 'picture of dorian gray',
  },
  {
    slug: 'heart-of-darkness',
    title: 'Heart of Darkness',
    author: 'Joseph Conrad',
    authorLastName: 'Conrad',
    year: 1899,
    genre: 'Novellas',
    description:
      'Marlow pilots a steamer up the Congo in search of the ivory trader Kurtz, and finds the emptiness at the heart of empire. A short, dense masterpiece told at dusk on the Thames.',
    gutenbergId: 219,
    librivoxQuery: 'heart of darkness',
  },
];

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(60_000),
        headers: { 'user-agent': 'ausculto-prepare-books/0.1 (open-source audiobook reader)' },
      });
      if (res.ok) return res;
      lastError = new Error(`HTTP ${res.status} for ${url}`);
      if (res.status === 404) break; // don't retry not-found
    } catch (err) {
      lastError = err;
    }
    await sleep(1000 * (attempt + 1));
  }
  throw lastError;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// LibriVox
// ---------------------------------------------------------------------------

interface LibrivoxSection {
  id: string;
  section_number: string;
  title: string;
  listen_url: string;
  playtime: string;
  language?: string;
}

interface LibrivoxBook {
  id: string;
  title: string;
  language: string;
  totaltimesecs: number;
  num_sections: string;
  url_librivox?: string;
  authors?: { first_name?: string; last_name?: string }[];
  sections?: LibrivoxSection[];
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

async function searchLibrivox(book: CuratedBook): Promise<LibrivoxBook | undefined> {
  if (book.librivoxId) {
    return fetchLibrivoxById(book.librivoxId);
  }
  const url = `https://librivox.org/api/feed/audiobooks/?format=json&limit=50&title=${encodeURIComponent(book.librivoxQuery)}`;
  const res = await fetchWithRetry(url);
  const data = (await res.json()) as { books?: LibrivoxBook[]; error?: string };
  if (!data.books?.length) return undefined;

  const wantTitle = normalize(book.librivoxQuery);
  const wantAuthor = normalize(book.authorLastName);

  const candidates = data.books.filter((b) => {
    if (b.language !== 'English') return false;
    const title = normalize(b.title);
    if (!title.includes(wantTitle)) return false;
    if (title.includes('dramatic reading') || normalize(b.title).includes('abridged')) return false;
    const authors = (b.authors ?? [])
      .map((a) => normalize(`${a.first_name ?? ''} ${a.last_name ?? ''}`))
      .join(' | ');
    // If the API returned author data, require a match; otherwise accept.
    return authors.length === 0 || authors.includes(wantAuthor);
  });
  if (!candidates.length) return undefined;

  // Prefer an exact title match, then the earliest (lowest-id) recording —
  // usually the canonical complete solo/collaborative reading.
  candidates.sort((a, b) => {
    const exactA = normalize(a.title) === wantTitle ? 0 : 1;
    const exactB = normalize(b.title) === wantTitle ? 0 : 1;
    if (exactA !== exactB) return exactA - exactB;
    return Number(a.id) - Number(b.id);
  });

  return fetchLibrivoxById(Number(candidates[0].id));
}

async function fetchLibrivoxById(id: number): Promise<LibrivoxBook | undefined> {
  const url = `https://librivox.org/api/feed/audiobooks/?format=json&id=${id}&extended=1`;
  const res = await fetchWithRetry(url);
  const data = (await res.json()) as { books?: LibrivoxBook[] };
  return data.books?.[0];
}

// ---------------------------------------------------------------------------
// Gutenberg
// ---------------------------------------------------------------------------

async function fetchGutenbergText(id: number): Promise<string> {
  const urls = [
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    `https://www.gutenberg.org/files/${id}/${id}.txt`,
  ];
  let lastError: unknown;
  for (const url of urls) {
    try {
      const res = await fetchWithRetry(url, 2);
      return await res.text();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

/** Strip the Project Gutenberg license header/footer. */
function stripBoilerplate(raw: string): string {
  const text = raw.replace(/\r\n/g, '\n');
  const start = text.search(/\*\*\* ?START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i);
  const end = text.search(/\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i);
  let body = text;
  if (start !== -1) body = body.slice(body.indexOf('\n', start) + 1);
  if (end !== -1) body = body.slice(0, body.search(/\*\*\* ?END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i));
  return body.trim();
}

/** Blocks separated by blank lines; internal hard-wrapped newlines joined. */
function toParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n+/)
    .map((block) => block.replace(/\s*\n\s*/g, ' ').trim())
    .filter((p) => p.length > 0);
}

const HEADING_PATTERNS: RegExp[] = [
  /^(chapter|letter|book|part|stave|canto|act|epilogue|prologue|preface|introduction)\b/i,
  /^the\s+(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth)\s+book\b/i,
  /^[IVXLCDM]+\.?$/, // bare roman numeral
  /^[IVXLCDM]+\.\s+\S.{0,70}$/, // "I. LAYING PLANS"
];

function isHeading(paragraph: string): boolean {
  if (paragraph.length > 90) return false;
  return HEADING_PATTERNS.some((re) => re.test(paragraph));
}

interface TextSection {
  title: string;
  paragraphs: string[];
}

/** Split paragraphs into sections at heading paragraphs. */
function splitByHeadings(paragraphs: string[]): TextSection[] {
  const sections: TextSection[] = [];
  let current: TextSection | undefined;
  for (const p of paragraphs) {
    if (isHeading(p)) {
      if (current) sections.push(current);
      current = { title: p, paragraphs: [] };
    } else if (current) {
      current.paragraphs.push(p);
    }
    // Paragraphs before the first heading (title page, contents) are dropped.
  }
  if (current) sections.push(current);
  return sections.filter((s) => s.paragraphs.length > 0);
}

/**
 * Distribute paragraphs across N chapters proportionally to each chapter's
 * audio playtime. Used when heading detection doesn't line up with the
 * recording's section list.
 */
function splitProportionally(paragraphs: string[], playtimes: number[]): string[][] {
  const totalChars = paragraphs.reduce((sum, p) => sum + p.length, 0);
  const totalTime = playtimes.reduce((a, b) => a + b, 0) || playtimes.length;
  const result: string[][] = playtimes.map(() => []);
  let chapter = 0;
  let charBudget = ((playtimes[0] || 1) / totalTime) * totalChars;
  let used = 0;
  for (const p of paragraphs) {
    const remainingChapters = playtimes.length - chapter - 1;
    const remainingParagraphs = paragraphs.length - paragraphs.indexOf(p);
    if (used >= charBudget && chapter < playtimes.length - 1 && remainingParagraphs > remainingChapters) {
      chapter++;
      charBudget += ((playtimes[chapter] || 1) / totalTime) * totalChars;
    }
    result[chapter].push(p);
    used += p.length;
  }
  return result;
}

// ---------------------------------------------------------------------------
// Open Library covers
// ---------------------------------------------------------------------------

async function fetchCoverUrl(book: CuratedBook): Promise<string | undefined> {
  try {
    const url = `https://openlibrary.org/search.json?title=${encodeURIComponent(book.title)}&author=${encodeURIComponent(book.authorLastName)}&limit=5&fields=cover_i,title`;
    const res = await fetchWithRetry(url, 2);
    const data = (await res.json()) as { docs?: { cover_i?: number }[] };
    const withCover = data.docs?.find((d) => d.cover_i);
    if (withCover?.cover_i) {
      return `https://covers.openlibrary.org/b/id/${withCover.cover_i}-L.jpg`;
    }
  } catch {
    // fall through — the app renders a typographic placeholder
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

interface GeneratedChapter {
  title: string;
  audioUrl: string;
  duration: number;
}

interface GeneratedBook {
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
  totalDuration: number;
  textMapping: 'exact' | 'proportional';
  chapters: GeneratedChapter[];
}

/**
 * LibriVox catalog playtimes are occasionally garbage (e.g. "15" for a
 * 15-minute file). For implausibly short sections, estimate the duration from
 * the MP3's byte size — LibriVox 64 kbps files are constant bitrate.
 */
async function fixSuspectPlaytime(section: LibrivoxSection): Promise<number> {
  const listed = Number(section.playtime) || 0;
  if (listed >= 60) return listed;
  const url = section.listen_url.replace(/^http:/, 'https:');
  try {
    let size = 0;
    const head = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(30_000) });
    size = Number(head.headers.get('content-length')) || 0;
    if (!size) {
      const ranged = await fetch(url, {
        headers: { range: 'bytes=0-0' },
        signal: AbortSignal.timeout(30_000),
      });
      const match = ranged.headers.get('content-range')?.match(/\/(\d+)$/);
      size = match ? Number(match[1]) : 0;
    }
    if (size > 0) {
      const estimated = Math.round((size * 8) / 64_000);
      console.warn(
        `  [warn] "${section.title}" playtime ${listed}s looks wrong; estimated ${estimated}s from file size`,
      );
      return estimated;
    }
  } catch {
    /* keep the listed value */
  }
  return listed;
}

async function processBook(book: CuratedBook): Promise<GeneratedBook | undefined> {
  console.log(`\n=== ${book.title} ===`);

  const lv = await searchLibrivox(book);
  if (!lv) {
    console.warn(`  [SKIP] no LibriVox recording found for "${book.librivoxQuery}"`);
    return undefined;
  }
  const sections = (lv.sections ?? []).filter((s) => s.listen_url);
  if (!sections.length) {
    console.warn(`  [SKIP] LibriVox ${lv.id} ("${lv.title}") has no playable sections`);
    return undefined;
  }
  console.log(`  librivox: id=${lv.id} "${lv.title}" — ${sections.length} sections`);

  const raw = await fetchGutenbergText(book.gutenbergId);
  const paragraphs = toParagraphs(stripBoilerplate(raw));
  const headingSections = splitByHeadings(paragraphs);
  console.log(`  gutenberg: ${paragraphs.length} paragraphs, ${headingSections.length} detected headings`);

  const playtimes: number[] = [];
  for (const s of sections) playtimes.push(await fixSuspectPlaytime(s));

  let mapping: GeneratedBook['textMapping'];
  let chapterTexts: TextSection[];
  if (headingSections.length === sections.length) {
    mapping = 'exact';
    chapterTexts = headingSections;
  } else {
    mapping = 'proportional';
    const distributed = splitProportionally(paragraphs, playtimes);
    chapterTexts = distributed.map((paras, i) => ({
      title: sections[i].title,
      paragraphs: paras,
    }));
    console.warn(
      `  [warn] heading count (${headingSections.length}) != section count (${sections.length}); using proportional text split`,
    );
  }

  const bookDir = join(ROOT, 'public', 'books', book.slug);
  await mkdir(bookDir, { recursive: true });
  for (let i = 0; i < sections.length; i++) {
    const text = chapterTexts[i] ?? { title: sections[i].title, paragraphs: [] };
    await writeFile(
      join(bookDir, `${i}.json`),
      JSON.stringify({ title: sections[i].title, paragraphs: text.paragraphs }),
      'utf-8',
    );
  }

  const coverUrl = await fetchCoverUrl(book);
  console.log(`  cover: ${coverUrl ?? '(none — typographic placeholder)'}`);

  return {
    slug: book.slug,
    title: book.title,
    author: book.author,
    year: book.year,
    genre: book.genre,
    description: book.description,
    coverUrl,
    gutenbergId: book.gutenbergId,
    librivoxId: Number(lv.id),
    librivoxUrl: lv.url_librivox,
    totalDuration: playtimes.reduce((a, b) => a + b, 0),
    textMapping: mapping,
    chapters: sections.map((s, i) => ({
      title: cleanSectionTitle(s.title, i),
      audioUrl: s.listen_url.replace(/^http:/, 'https:'),
      duration: playtimes[i],
    })),
  };
}

/** LibriVox section titles are inconsistent ("01 - Chapter 1", "Ch. 01"...). Tidy lightly. */
function cleanSectionTitle(title: string, index: number): string {
  const cleaned = title.replace(/^\s*\d+\s*[-–—.]\s*/, '').trim();
  return cleaned || `Section ${index + 1}`;
}

async function main() {
  const only = process.argv.slice(2);
  const list = only.length ? CURATED.filter((b) => only.includes(b.slug)) : CURATED;

  const generated: GeneratedBook[] = [];
  const skipped: string[] = [];

  for (const book of list) {
    try {
      const result = await processBook(book);
      if (result) generated.push(result);
      else skipped.push(book.slug);
    } catch (err) {
      console.error(`  [ERROR] ${book.slug}:`, err instanceof Error ? err.message : err);
      skipped.push(book.slug);
    }
    await sleep(500); // be polite to the APIs
  }

  // When re-running for a subset, merge into the existing file.
  const outPath = join(ROOT, 'src', 'data', 'books.generated.json');
  let existing: GeneratedBook[] = [];
  if (only.length) {
    try {
      const { readFile } = await import('node:fs/promises');
      existing = JSON.parse(await readFile(outPath, 'utf-8')) as GeneratedBook[];
    } catch {
      /* first run */
    }
  }
  const merged = [
    ...existing.filter((b) => !generated.some((g) => g.slug === b.slug)),
    ...generated,
  ];
  // Preserve curated ordering
  merged.sort(
    (a, b) => CURATED.findIndex((c) => c.slug === a.slug) - CURATED.findIndex((c) => c.slug === b.slug),
  );

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(merged, null, 2), 'utf-8');

  console.log(`\nDone. ${merged.length} books written to src/data/books.generated.json`);
  if (skipped.length) console.log(`Skipped: ${skipped.join(', ')}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
