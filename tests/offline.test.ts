import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import type { Book } from '../src/data/types';
import { downloadBookForOffline } from '../src/lib/offline';

const book = {
  slug: 'test-book',
  chapters: [{ audioUrl: 'https://archive.org/download/test/chapter.mp3' }],
} as Book;

function setup(t: TestContext, active = true) {
  const stored = new Map<string, Uint8Array>();
  const requests: string[] = [];
  const progress: number[][] = [];
  const environment = {
    navigator: { serviceWorker: { controller: active ? {} : null } },
    caches: {
      open: async (name: string) => ({
        put: async (url: string, response: Response) => {
          stored.set(`${name}:${url}`, new Uint8Array(await response.arrayBuffer()));
        },
      }),
    },
    fetch: async (url: string) => {
      requests.push(url);
      return new Response(url.endsWith('.json') ? '{"paragraphs":["Test"]}' : 'complete audio');
    },
  };
  for (const [key, value] of Object.entries(environment)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
    Object.defineProperty(globalThis, key, { configurable: true, value });
    t.after(() => {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    });
  }
  const download = () => downloadBookForOffline(book, (done, total) => progress.push([done, total]));
  return { environment, stored, requests, progress, download };
}

test('offline download writes complete chapter text and audio before reporting success', async (t) => {
  const { download, stored, progress } = setup(t);
  assert.equal(await download(), true);
  assert.equal(new TextDecoder().decode(stored.get('ausculto-audio:' + book.chapters[0].audioUrl)), 'complete audio');
  assert.equal(new TextDecoder().decode(stored.get('ausculto-text:/books/test-book/0.json')), '{"paragraphs":["Test"]}');
  assert.deepEqual(progress, [[1, 1]]);
});

test('offline download cannot succeed without a controlling service worker', async (t) => {
  const { download, requests, stored } = setup(t, false);
  assert.equal(await download(), false);
  assert.deepEqual(requests, []);
  assert.equal(stored.size, 0);
});

test('offline download reports unavailable cache storage', async (t) => {
  const { download, environment } = setup(t);
  environment.caches.open = async () => { throw new Error('Storage unavailable'); };
  assert.equal(await download(), false);
});

test('offline download reports a failed cache write even when fetch succeeds', async (t) => {
  const { download, environment, progress } = setup(t);
  environment.caches.open = async () => ({ put: async () => { throw new DOMException('Storage full', 'QuotaExceededError'); } });
  assert.equal(await download(), false);
  assert.deepEqual(progress, [[1, 1]]);
});

test('partial audio responses cannot mark a book available offline', async (t) => {
  const { download, stored } = setup(t);
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async (url: string) => new Response('partial', { status: url.endsWith('.mp3') ? 206 : 200 }),
  });
  assert.equal(await download(), false);
  assert.equal(stored.has('ausculto-audio:' + book.chapters[0].audioUrl), false);
});

test('failed chapter requests leave the download retryable', async (t) => {
  const { download, stored, progress } = setup(t);
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: async () => new Response('Unavailable', { status: 503 }),
  });
  assert.equal(await download(), false);
  assert.equal(stored.size, 0);
  assert.deepEqual(progress, [[1, 1]]);
});

test('success waits for the audio cache write to finish', async (t) => {
  const { download, environment } = setup(t);
  let release!: () => void;
  let started!: () => void;
  const writing = new Promise<void>((resolve) => { started = resolve; });
  const gate = new Promise<void>((resolve) => { release = resolve; });
  environment.caches.open = async (name: string) => ({
    put: async () => {
      if (name === 'ausculto-audio') { started(); await gate; }
    },
  });
  let finished = false;
  const result = download().then((ok) => { finished = true; return ok; });
  await writing;
  assert.equal(finished, false);
  release();
  assert.equal(await result, true);
});
