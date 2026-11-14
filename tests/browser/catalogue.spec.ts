import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import type { Book, ChapterAlignment, ReadAlongBook } from '../../src/data/types';

const books = JSON.parse(readFileSync('src/data/books.generated.json', 'utf8')) as Book[];
const durations = Object.fromEntries(books.flatMap(b => b.chapters.flatMap(c => c.audioParts!.map(p => [p.audioUrl, p.duration]))));
const readAlong = JSON.parse(readFileSync('src/data/alignments/catalogue.json', 'utf8')) as Record<string, ReadAlongBook>;
const alignedChapter = (i: number) => JSON.parse(readFileSync(`public${readAlong['metamorphosis'].chapters[i].url}`, 'utf8')) as ChapterAlignment;

async function setup(page: Page, state: Record<string, unknown> = {}) {
  await page.route(/^https?:\/\/(?!127\.0\.0\.1:517[45])/, route => route.abort());
  await page.addInitScript(({ durations, state }) => {
    if (Object.keys(state).length && !sessionStorage.getItem('test-seeded')) {
      localStorage.setItem('ausculto', JSON.stringify({ state, version: 0 }));
      sessionStorage.setItem('test-seeded', 'yes');
    }
    class TestAudio extends EventTarget {
      private url = '';
      private time = 0;
      readyState = 0;
      duration = 0;
      paused = true;
      error = null;
      playbackRate = 1;
      crossOrigin = '';
      preload = '';
      constructor() { super(); (window as any).__audio = this; }
      get src() { return this.url; }
      set src(url: string) {
        this.url = url; this.time = 0; this.readyState = 0; this.paused = true;
        setTimeout(() => {
          if (this.url !== url) return;
          this.duration = durations[url] ?? 100;
          this.readyState = 1;
          this.dispatchEvent(new Event('loadedmetadata'));
          this.dispatchEvent(new Event('durationchange'));
        }, 0);
      }
      get currentTime() { return this.time; }
      set currentTime(time: number) { this.time = time; queueMicrotask(() => this.dispatchEvent(new Event('timeupdate'))); }
      advanceWithoutTimeUpdate(time: number) { this.time = time; }
      async play() { this.paused = false; this.dispatchEvent(new Event('play')); }
      pause() { const wasPlaying = !this.paused; this.paused = true; if (wasPlaying) this.dispatchEvent(new Event('pause')); }
      removeAttribute(name: string) { if (name === 'src') { this.url = ''; this.readyState = 0; this.time = 0; } }
      load() {}
      end() { this.time = this.duration; this.paused = true; this.dispatchEvent(new Event('timeupdate')); this.dispatchEvent(new Event('ended')); }
    }
    (window as any).Audio = TestAudio;
  }, { durations, state });
}

async function seek(page: Page, time: number) {
  await page.getByRole('slider').evaluate((input, value) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, String(value));
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, time);
}

test('home opens with the strongest match and retains quality ordering through genre filters', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  await expect(page.locator('a[href^="/book/"]').first()).toHaveAttribute('href', '/book/alice-in-wonderland');
  await page.getByRole('tab', { name: 'Horror & Gothic' }).click();
  await expect(page.locator('a[href^="/book/"]').first()).toHaveAttribute('href', '/book/dracula');
  await page.getByRole('tab', { name: 'All', exact: true }).click();
  await page.screenshot({ path: 'test-results/home.png', fullPage: true });
});

test('Pride and Prejudice starts in the novel and next recording opens at chapter four', async ({ page }) => {
  await setup(page);
  await page.goto('/book/pride-and-prejudice');
  await expect(page.locator('[data-pidx="0"]')).toContainText('It is a truth universally acknowledged');
  await page.getByRole('button', { name: 'Next chapter', exact: true }).click();
  await expect(page.locator('[data-pidx="0"]')).toContainText('When Jane and Elizabeth were alone');
  await expect.poll(() => page.evaluate(() => (window as any).__audio.src)).toBe(books.find(b => b.slug === 'pride-and-prejudice')!.chapters[1].audioUrl);
});

test('multipart playback restores a legacy part, seeks across parts, and advances within the same chapter', async ({ page }) => {
  const book = books.find(b => b.slug === 'walden')!;
  const first = book.chapters[0].audioParts!;
  const offset = first.slice(0, 3).reduce((sum, p) => sum + p.duration, 0);
  await setup(page, { progress: { walden: { chapterIndex: 3, position: 40, updatedAt: 123 } }, downloaded: ['walden'] });
  await page.goto('/book/walden');
  await expect(page.getByRole('slider')).toHaveValue(String(offset + 40));
  await expect.poll(() => page.evaluate(() => (window as any).__audio.currentTime)).toBe(40);
  await expect(page.getByRole('button', { name: 'Download all chapters for offline listening' })).toBeEnabled();
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await seek(page, first[0].duration + 15);
  await expect.poll(() => page.evaluate(() => (window as any).__audio.src)).toBe(first[1].audioUrl);
  await expect.poll(() => page.evaluate(() => (window as any).__audio.currentTime)).toBe(15);
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible();
  await seek(page, first[0].duration - 10);
  await expect.poll(() => page.evaluate(() => (window as any).__audio.src)).toBe(first[0].audioUrl);
  await page.evaluate(() => (window as any).__audio.end());
  await expect.poll(() => page.evaluate(() => (window as any).__audio.src)).toBe(first[1].audioUrl);
  await expect(page.getByRole('slider')).toHaveValue(String(first[0].duration));
  await expect(page.getByRole('region', { name: 'Audio player' })).toContainText('1. Economy');
  await page.getByRole('button', { name: 'Next chapter', exact: true }).click();
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ausculto')!).state.progress.walden.chapterIndex)).toBe(5);
  await expect(page.getByRole('region', { name: 'Audio player' })).toContainText('Where I Lived');
});

test('legacy highlights move to their actual passage and old part bookmarks use current chapter links', async ({ page }) => {
  const text = 'It is a truth universally acknowledged';
  await setup(page, {
    highlights: [{ id: 'old-highlight', bookSlug: 'pride-and-prejudice', chapterIndex: 2, startOffset: 1, endOffset: 12, text, note: 'My saved note', createdAt: 1 }],
    bookmarks: [{ id: 'old-bookmark', bookSlug: 'walden', chapterIndex: 6, createdAt: 1 }],
  });
  await page.goto('/book/pride-and-prejudice?chapter=2&hl=old-highlight');
  await expect(page.locator('[data-hid="old-highlight"]')).toHaveText(text);
  await expect(page.getByRole('region', { name: 'Audio player' })).toContainText('Chapters 1-3');
  await page.goto('/saved');
  await expect(page.getByText('My saved note')).toBeVisible();
  await expect(page.locator('a[href^="/book/walden?chapter="]')).toHaveAttribute('href', /chapter=1&v=/);
});

test('a legacy alternate reading resumes in the selected canonical chapter without repeating chapter one', async ({ page }) => {
  await setup(page, { progress: { 'the-time-machine': { chapterIndex: 1, position: 731, updatedAt: 1 } } });
  await page.goto('/book/the-time-machine');
  await expect(page.getByRole('slider')).toHaveValue('586');
  await page.getByRole('button', { name: 'Next chapter', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Audio player' })).toContainText('Chapter 2');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('ausculto')!).state.progress['the-time-machine'].chapterIndex)).toBe(2);
});

test('production service worker bypasses old text and serves the corrected edition offline', async ({ page, context }) => {
  await setup(page);
  await page.goto('http://127.0.0.1:5175/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.evaluate(async () => {
    const cache = await caches.open('ausculto-text');
    await cache.put('/books/pride-and-prejudice/0.json', new Response(JSON.stringify({ title: 'Old text', paragraphs: ['GEORGE ALLEN PUBLISHER'] }), { headers: { 'Content-Type': 'application/json' } }));
  });
  await page.goto('http://127.0.0.1:5175/book/pride-and-prejudice');
  await expect(page.locator('[data-pidx="0"]')).toContainText('It is a truth universally acknowledged');
  const revision = books.find(b => b.slug === 'pride-and-prejudice')!.textRevision!;
  await expect.poll(() => page.evaluate(async v => {
    const cache = await caches.open('ausculto-text');
    return !!(await cache.match(`/books/pride-and-prejudice/0.json?v=${v}`));
  }, revision)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('[data-pidx="0"]')).toContainText('It is a truth universally acknowledged');
});

test('read-along badges identify complete titles and word highlighting follows seeks and chapter changes', async ({ page }) => {
  await setup(page);
  await page.goto('/');
  await expect(page.locator('a[href="/book/metamorphosis"]')).toContainText('Read-along synced');
  await expect(page.locator('a[href="/book/the-art-of-war"]')).toContainText('Read-along synced');
  await expect(page.locator('a[href="/book/jane-eyre"]')).not.toContainText('Read-along synced');
  await expect(page.locator('a[href="/book/alice-in-wonderland"]')).not.toContainText('Read-along synced');
  await page.locator('a[href="/book/metamorphosis"]').click();
  await expect(page.locator('[data-pidx="0"]')).toContainText('One morning, as Gregor Samsa');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(page.locator('.active-word')).toHaveCount(0);
  const data = alignedChapter(0);
  for (const word of [data.words[0], data.words[Math.floor(data.words.length / 2)], data.words[4]]) {
    await page.evaluate(time => { (window as any).__audio.advanceWithoutTimeUpdate(time); }, (word.start + word.end) / 2);
    await expect.poll(async () => (await page.locator('.active-word').allTextContents()).join('')).toBe(word.word);
  }
  await page.evaluate(time => { (window as any).__audio.currentTime = time; }, data.words.at(-1)!.end + 1);
  await expect(page.locator('.active-word')).toHaveCount(0);
  await page.getByRole('button', { name: 'Next chapter', exact: true }).click();
  await expect(page.locator('[data-pidx="0"]')).toContainText('Gregor first woke up');
  const word = alignedChapter(1).words[5];
  await page.evaluate(time => { (window as any).__audio.currentTime = time; }, (word.start + word.end) / 2);
  await expect.poll(async () => (await page.locator('.active-word').allTextContents()).join('')).toBe(word.word);
  await page.screenshot({ path: 'test-results/read-along.png', fullPage: false });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.screenshot({ path: 'test-results/read-along-mobile.png', fullPage: true });
});

test('unavailable timing data leaves the complete chapter readable', async ({ page }) => {
  await setup(page);
  await page.route(/\/alignments\/[^/]+\/\d+\.[a-f0-9]{12}\.json$/, route => route.fulfill({ status: 503, body: 'unavailable' }));
  await page.goto('/book/metamorphosis');
  await expect(page.locator('[data-pidx="0"]')).toContainText('One morning, as Gregor Samsa');
  await expect(page.getByText('Loading chapter text')).toHaveCount(0);
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const word = alignedChapter(0).words[10];
  await page.evaluate(time => { (window as any).__audio.currentTime = time; }, (word.start + word.end) / 2);
  await expect(page.locator('.active-word')).toHaveCount(0);
});

test('production caches timing assets and restores word highlighting after an offline reload', async ({ page, context }) => {
  await setup(page);
  await page.goto('http://127.0.0.1:5175/');
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.goto('http://127.0.0.1:5175/book/metamorphosis');
  const url = readAlong['metamorphosis'].chapters[0].url;
  await expect.poll(() => page.evaluate(async url => !!(await (await caches.open('ausculto-alignments')).match(url)), url)).toBe(true);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('[data-pidx="0"]')).toContainText('One morning, as Gregor Samsa');
  await page.getByRole('button', { name: 'Play', exact: true }).click();
  const word = alignedChapter(0).words[10];
  await page.evaluate(time => { (window as any).__audio.currentTime = time; }, (word.start + word.end) / 2);
  await expect.poll(async () => (await page.locator('.active-word').allTextContents()).join('')).toBe(word.word);
});
