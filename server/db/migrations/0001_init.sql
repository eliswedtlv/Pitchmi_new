-- PitchMi v1 initial schema (spec §4).
-- Apply against your Supabase project (SQL Editor or psql), in filename order.

-- projects: one per "video the user is working on"
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  title text not null default 'Untitled',
  use_case text not null default 'pitch',     -- pitch | intro | sales | social | custom
  use_case_custom text,                        -- free text when use_case='custom'
  language text,                               -- BCP-47, auto-detected from take 1
  script text,                                 -- current edited transcript
  original_words jsonb,                        -- take-1 Scribe word timings (needed by /api/path; addition beyond §4)
  path jsonb,                                  -- current karaoke path (see §6)
  speed numeric not null default 1.0,          -- global speed slider 0.75–1.25
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- saved_takes: ONLY explicit "Save to cloud" — nothing else is ever stored
create table if not exists saved_takes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id),
  user_id uuid not null references auth.users(id),
  storage_path text not null,                  -- videos/{user_id}/{take_id}.webm
  duration_s numeric,
  scores jsonb,                                -- full evaluation payload at save time
  created_at timestamptz default now()
);

-- events: append-only ops log (metadata only, NEVER video content or transcript text)
create table if not exists events (
  id bigserial primary key,
  ts timestamptz default now(),
  user_id uuid,
  action text not null,       -- transcribe | path | evaluate | save | admin_login | surge_trip | error
  project_id uuid,
  duration_s numeric,         -- video duration
  language text,
  scores jsonb,               -- numeric scores only
  latency_ms integer,
  cost_usd numeric,
  error text
);
create index if not exists events_ts_idx on events (ts desc);
create index if not exists events_user_action_ts_idx on events (user_id, action, ts desc);

-- app_settings: single-row-ish key/value
create table if not exists app_settings (
  key text primary key,
  value jsonb not null
);
insert into app_settings (key, value) values ('service_enabled', 'true')
on conflict (key) do nothing;

-- Row Level Security -------------------------------------------------------

alter table projects enable row level security;
alter table saved_takes enable row level security;
alter table events enable row level security;
alter table app_settings enable row level security;

-- projects: owner-only, all verbs.
drop policy if exists projects_owner on projects;
create policy projects_owner on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- saved_takes: owner-only, all verbs.
drop policy if exists saved_takes_owner on saved_takes;
create policy saved_takes_owner on saved_takes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- events / app_settings: no anon/authenticated policies -> service-role only.
-- (RLS enabled with no policy = deny for anon/authenticated; the server uses
--  the service-role key which bypasses RLS.)

-- Storage ------------------------------------------------------------------
-- Create a PRIVATE bucket named 'videos' in the Supabase dashboard (or via the
-- storage API). Playback is via short-lived signed URLs minted by the server.
--   select storage.create_bucket('videos', public => false);   -- if available
