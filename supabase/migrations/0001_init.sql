-- Ausculto initial schema
-- Run via the Supabase SQL editor or `supabase db push`.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Reader',
  -- Opt-in/out of being counted in "X people reading" badges
  share_activity boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_slug text not null,
  chapter_index integer not null default 0,
  audio_position_seconds double precision not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, book_slug)
);

create table public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_slug text not null,
  chapter_index integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, book_slug, chapter_index)
);

create table public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  book_slug text not null,
  chapter_index integer not null,
  -- Character offsets into the chapter's plain text (paragraphs joined with \n\n)
  start_offset integer not null,
  end_offset integer not null,
  text_snippet text not null,
  created_at timestamptz not null default now()
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  highlight_id uuid not null references public.highlights (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One note per highlight
  unique (highlight_id)
);

-- Powers both personal stats (sum of durations) and social reader counts
create table public.reading_activity (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  book_slug text not null,
  chapter_index integer not null default 0,
  duration_seconds integer not null,
  date date not null default current_date,
  created_at timestamptz not null default now()
);

create index reading_activity_user_idx on public.reading_activity (user_id, date);
create index reading_activity_recent_idx on public.reading_activity (created_at, book_slug);
create index highlights_user_book_idx on public.highlights (user_id, book_slug);
create index bookmarks_user_book_idx on public.bookmarks (user_id, book_slug);

-- ---------------------------------------------------------------------------
-- Row Level Security — users touch only their own rows
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.reading_progress enable row level security;
alter table public.bookmarks enable row level security;
alter table public.highlights enable row level security;
alter table public.notes enable row level security;
alter table public.reading_activity enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own progress" on public.reading_progress
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own bookmarks" on public.bookmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own highlights" on public.highlights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own notes" on public.notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own activity" on public.reading_activity
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Signed-in users may see activity rows of readers who opted in to sharing —
-- this feeds the Realtime "someone started reading" refetch signal.
create policy "shared activity is readable" on public.reading_activity
  for select to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = reading_activity.user_id and p.share_activity
    )
  );

-- ---------------------------------------------------------------------------
-- Aggregate reader counts, safe for anonymous use (no per-user data exposed)
-- ---------------------------------------------------------------------------

create or replace function public.reader_counts()
returns table (book_slug text, readers bigint)
language sql
security definer
set search_path = public
stable
as $$
  select ra.book_slug, count(distinct ra.user_id) as readers
  from public.reading_activity ra
  join public.profiles p on p.id = ra.user_id and p.share_activity
  where ra.created_at > now() - interval '7 days'
  group by ra.book_slug;
$$;

grant execute on function public.reader_counts() to anon, authenticated;

-- Realtime stream used as a live refetch signal for reader counts
alter publication supabase_realtime add table public.reading_activity;
