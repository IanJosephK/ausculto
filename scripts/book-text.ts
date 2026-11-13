/** Edition-specific body extraction. Unknown layouts fail instead of guessing. */
export interface TextSection { id: string; title: string; paragraphs: string[] }

export const roman = (n: number): string => {
  const values: [number, string][] = [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
  let result = '';
  for (const [value, digit] of values) while (n >= value) { result += digit; n -= value; }
  return result;
};

export function stripBoilerplate(raw: string): string {
  const text = raw.replace(/\r\n?/g, '\n');
  const start = /\*\*\*\s*START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[^\n]*\*\*\*/i.exec(text);
  const end = /\*\*\*\s*END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK/i.exec(text);
  if (!start || !end || end.index <= start.index) throw new Error('Missing Gutenberg body markers');
  return text.slice(start.index + start[0].length, end.index).trim();
}

export const toParagraphs = (text: string): string[] => text.split(/\n\s*\n+/)
  .map(p => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);

/** Select a body heading using a known opening phrase, bypassing the contents. */
function bodyFrom(paragraphs: string[], opening: string, isHeading: (p: string) => boolean): string[] {
  const first = paragraphs.findIndex(p => p.includes(opening));
  if (first < 0) throw new Error(`Missing opening: ${opening}`);
  for (let i = first; i >= 0; i--) if (isHeading(paragraphs[i])) return paragraphs.slice(i);
  throw new Error(`Missing body heading before: ${opening}`);
}

function split(paragraphs: string[], heading: (p: string) => string | undefined, expected: number): TextSection[] {
  const sections: TextSection[] = [];
  for (const p of paragraphs) {
    const id = heading(p);
    if (id) sections.push({ id, title: p, paragraphs: [] });
    else if (sections.length) sections.at(-1)!.paragraphs.push(p);
  }
  if (sections.length !== expected || new Set(sections.map(s => s.id)).size !== expected)
    throw new Error(`Expected ${expected} unique body sections; found ${sections.length}`);
  for (const s of sections) if (!s.paragraphs.length) throw new Error(`Empty section ${s.id}`);
  return sections;
}

export const WALDEN_TITLES = ['Economy', 'Where I Lived, and What I Lived For', 'Reading', 'Sounds', 'Solitude', 'Visitors', 'The Bean-Field', 'The Village', 'The Ponds', 'Baker Farm', 'Higher Laws', 'Brute Neighbors', 'House-Warming', 'Former Inhabitants and Winter Visitors', 'Winter Animals', 'The Pond in Winter', 'Spring', 'Conclusion'];
const JEKYLL_TITLES = ['STORY OF THE DOOR', 'SEARCH FOR MR. HYDE', 'DR. JEKYLL WAS QUITE AT EASE', 'THE CAREW MURDER CASE', 'INCIDENT OF THE LETTER', 'INCIDENT OF DR. LANYON', 'INCIDENT AT THE WINDOW', 'THE LAST NIGHT', 'DR. LANYON’S NARRATIVE', 'HENRY JEKYLL’S FULL STATEMENT OF THE CASE'];
const TREASURE_TITLES = ['The Old Sea-dog at the Admiral Benbow', 'Black Dog Appears and Disappears', 'The Black Spot', 'The Sea-chest', 'The Last of the Blind Man', 'The Captain’s Papers', 'I Go to Bristol', 'At the Sign of the Spy-glass', 'Powder and Arms', 'The Voyage', 'What I Heard in the Apple-Barrel', 'Council of War', 'How I Began My Shore Adventure', 'The First Blow', 'The Man of the Island', 'Narrative Continued by the Doctor: How the Ship Was Abandoned', 'Narrative Continued by the Doctor: The Jolly-boat’s Last Trip', 'Narrative Continued by the Doctor: End of the First Day’s Fighting', 'Narrative Resumed by Jim Hawkins: The Garrison in the Stockade', 'Silver’s Embassy', 'The Attack', 'How I Began My Sea Adventure', 'The Ebb-tide Runs', 'The Cruise of the Coracle', 'I Strike the Jolly Roger', 'Israel Hands', '“Pieces of Eight”', 'In the Enemy’s Camp', 'The Black Spot Again', 'On Parole', 'The Treasure-hunt--Flint’s Pointer', 'The Treasure-hunt--The Voice Among the Trees', 'The Fall of a Chieftain', 'And Last'];

function kafkaText(raw: string): string {
  const article = /<article\b[^>]*>([\s\S]*?)<\/article>/.exec(raw)?.[1];
  if (!article) throw new Error('Missing Kafka article');
  const entities: Record<string, string> = { ldquo: '“', rdquo: '”', rsquo: '’', lsquo: '‘', ndash: '–', mdash: '—', amp: '&', quot: '"', apos: "'", nbsp: ' ' };
  return article.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g, '')
    .replace(/<(?:em|i)>/g, '_').replace(/<\/(?:em|i)>/g, '_')
    .replace(/<\/(?:p|h2)>/g, '\n\n').replace(/<[^>]*>/g, '')
    .replace(/&([a-z]+);/g, (_, key: string) => {
      if (!(key in entities)) throw new Error(`Unknown HTML entity ${key}`);
      return entities[key];
    }).replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
}

export function extractSections(slug: string, raw: string): TextSection[] {
  let body = slug === 'metamorphosis' ? kafkaText(raw) : stripBoilerplate(raw);
  // Captions can contain chapter labels; preserve the opening chapter's label.
  body = body.replace(/\[Illustration[\s\S]*?\]/gi, caption => /Chapter I\.\]/i.test(caption) ? '\n\nCHAPTER I.\n\n' : '');
  let ps = toParagraphs(body);
  const stop = (pattern: RegExp) => {
    const i = ps.findIndex(p => pattern.test(p));
    if (i < 0) throw new Error(`Missing end boundary ${pattern}`);
    ps = ps.slice(0, i);
  };
  const numbered = (pattern: RegExp) => (p: string) => pattern.exec(p)?.[1];
  const start = (opening: string, heading: RegExp) => { ps = bodyFrom(ps, opening, p => heading.test(p)); };
  const clean = (sections: TextSection[]) => sections.map(s => ({ ...s, paragraphs: s.paragraphs.filter(p => !/^(?:PART (?:ONE|TWO|THREE|FOUR|FIVE|SIX)|Book the (?:First|Second|Third)|FIRST PART|SECOND PART)\b/.test(p) && !/^[-*_\s]{3,}$/.test(p)) }));

  switch (slug) {
    case 'pride-and-prejudice': {
      const re = /^CHAPTER ([IVXLCDM]+)\.?$/i;
      start('It is a truth universally acknowledged', re);
      stop(/^CHISWICK PRESS/);
      return split(ps, numbered(re), 61);
    }
    case 'jane-eyre':
      start('A preface to the first edition', /^PREFACE$/);
      return split(ps, p => p === 'PREFACE' ? 'preface' : /^CHAPTER ([IVXLCDM]+)(?:\.|—CONCLUSION)?$/i.exec(p)?.[1], 39);
    case 'the-great-gatsby':
      start('In my younger and more vulnerable years', /^I$/);
      return clean(split(ps, numbered(/^([IVX]+)$/), 9));
    case 'a-tale-of-two-cities': {
      const re = /^CHAPTER ([IVXLCDM]+)\.(?: .*)?$/;
      start('It was the best of times', re);
      let book = 0;
      return clean(split(ps, p => {
        const n = re.exec(p)?.[1];
        if (n === 'I') book++;
        return n ? `${book}-${n}` : undefined;
      }, 45));
    }
    case 'frankenstein': {
      const re = /^(Letter|Chapter) (\d+)$/;
      start('You will rejoice to hear', re);
      return split(ps, p => { const m = re.exec(p); return m ? `${m[1].toLowerCase()}-${m[2]}` : undefined; }, 28);
    }
    case 'dracula': {
      const re = /^CHAPTER ([IVXLCDM]+)$/;
      start('JONATHAN HARKER’S JOURNAL', re);
      stop(/^THE END$/);
      return split(ps, numbered(re), 27);
    }
    case 'jekyll-and-hyde':
      start('Mr. Utterson the lawyer', /^STORY OF THE DOOR$/);
      return split(ps, p => { const i = JEKYLL_TITLES.indexOf(p); return i < 0 ? undefined : String(i + 1); }, 10);
    case 'sherlock-holmes': {
      const re = /^([IVX]+)\. [A-Z][A-Z ’'—-]+$/;
      start('To Sherlock Holmes she is always', re);
      return split(ps, numbered(re), 12).map(s => ({ ...s, paragraphs: s.paragraphs.filter(p => !/^[IVX]+\.$/.test(p)) }));
    }
    case 'count-of-monte-cristo': {
      const re = /^Chapter (\d+)\. .+$/;
      start('On the 24th of February', re);
      stop(/^FOOTNOTES:$/);
      return split(ps, numbered(re), 117).map(s => ({ ...s, paragraphs: s.paragraphs.map(p => p.replace(/\[\d+\]/g, '')) }));
    }
    case 'treasure-island': {
      const id = (p: string) => {
        const title = /^[IVXLCDM]+ (.+)$/.exec(p)?.[1];
        const i = title ? TREASURE_TITLES.indexOf(title) : -1;
        return i < 0 ? undefined : String(i + 1);
      };
      ps = bodyFrom(ps, 'Squire Trelawney, Dr. Livesey', p => !!id(p));
      return clean(split(ps, id, 34));
    }
    case 'the-time-machine':
      start('The Time Traveller (for so it will be convenient', /^I$/);
      // This pinned historical edition has the recording's twelve divisions.
      stop(/^End of Project Gutenberg/);
      return split(ps, numbered(/^([IVX]+)$/), 12);
    case 'twenty-thousand-leagues': {
      start('THE YEAR 1866', /^CHAPTER 1$/);
      let part = 0;
      const sections = clean(split(ps, p => {
        const n = /^CHAPTER (\d+)$/.exec(p)?.[1];
        if (n === '1') part++;
        return n ? `${part}-${n}` : undefined;
      }, 47));
      return sections.map(s => ({ ...s, title: s.paragraphs[0], paragraphs: s.paragraphs.slice(1).filter(p => !/^\*(?:Author’s Note|Author's Note|German:|Ed\.)/.test(p)) }));
    }
    case 'alice-in-wonderland': {
      const re = /^CHAPTER ([IVX]+)\. .+$/;
      start('Alice was beginning to get very tired', re);
      return split(ps, numbered(re), 12);
    }
    case 'meditations': {
      const bio = ps.indexOf('BIOGRAPHICAL SKETCH');
      const philosophy = ps.indexOf('THE PHILOSOPHY');
      const first = ps.indexOf('I.');
      const last = ps.findIndex((p, i) => i > first && p === 'INDEX OF TERMS.');
      if (bio < 0 || philosophy <= bio || first <= philosophy || last <= first) throw new Error('Meditations essay boundaries changed');
      const removeNotes = (paras: string[]) => paras.filter(p => !/^\[[A-Z]\]/.test(p)).map(p => p.replace(/\[[A-Z]\]/g, ''));
      const thoughts = split(ps.slice(first, last), numbered(/^([IVX]+)\.$/), 12);
      // The essays precede the Thoughts in the text, but follow them in audio.
      return [
        ...thoughts.map(s => ({ ...s, paragraphs: removeNotes(s.paragraphs) })),
        { id: 'biography', title: 'M. Aurelius Antoninus', paragraphs: removeNotes(ps.slice(bio + 3, philosophy)) },
        { id: 'philosophy', title: 'The Philosophy of Marcus Aurelius', paragraphs: removeNotes(ps.slice(philosophy + 3, first - 3)) },
      ];
    }
    case 'the-art-of-war': {
      const re = /^([IVX]+)\. [A-ZŒ ,’-]+$/;
      start('1. Sun Tzŭ said:', re);
      return split(ps, numbered(re), 13);
    }
    case 'walden':
      ps = bodyFrom(ps, 'When I wrote the following pages', p => p === 'Economy');
      stop(/^ON THE DUTY OF CIVIL DISOBEDIENCE$/);
      return split(ps, p => { const i = WALDEN_TITLES.indexOf(p); return i < 0 ? undefined : String(i + 1); }, 18);
    case 'metamorphosis':
      return split(ps, numbered(/^([IV]+)\.$/), 3);
    case 'dorian-gray': {
      const re = /^CHAPTER ([IVX]+)$/;
      start('The studio was filled', re);
      ps = ps.filter(p => !/^End of Project Gutenberg/.test(p));
      return split(ps, numbered(re), 13).map(s => ({ ...s, paragraphs: s.paragraphs.map(p => p.replace(/\[\d+\]\s*/g, '')) }));
    }
    case 'heart-of-darkness':
      start('The Nellie, a cruising yawl', /^I$/);
      return split(ps, numbered(/^([IV]+)$/), 3);
    default: throw new Error(`No reviewed extraction profile for ${slug}`);
  }
}
