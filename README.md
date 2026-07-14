# Ausculto

*Latin: "I listen."*

A free, open-source audiobook reader that pairs [LibriVox](https://librivox.org)
public-domain recordings with [Project Gutenberg](https://www.gutenberg.org)
full text, so you can follow along as you listen. 19 classic books, offline
support, highlights & notes, and lightweight social features. Works fully
without an account.

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

Book data (text + audio metadata) is already generated and checked in. To
refresh it or add books, see [ADDING_BOOKS.md](ADDING_BOOKS.md).

## Supabase (optional)

Without configuration the app runs in guest mode: reading, listening, search,
and progress all work, saved to this device. To enable accounts, cloud sync,
and social features:

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. Run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)
   in the SQL editor.
3. Enable the Google provider under Authentication → Providers (optional).
4. Copy `.env.example` to `.env` and fill in the project URL and anon key.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` | Type-check + production build (`dist/`) |
| `npm run preview` | Serve the production build locally (service worker active) |
| `npm run prepare-books` | Regenerate book data from LibriVox + Gutenberg |
| `npm run generate-alignments -- <slug> [n]` | Word-level sync data via Whisper |

## Deploying

The build is a static SPA — deploy `dist/` anywhere. For Vercel, the included
`vercel.json` handles the SPA rewrite; set the two `VITE_SUPABASE_*` env vars
in the project settings if you use Supabase.

## Stack

React 18 + TypeScript + Vite · Tailwind CSS · Zustand · React Router ·
Supabase (auth/db/realtime) · Fuse.js · Workbox PWA
