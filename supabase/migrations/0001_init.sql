-- ===========================================================================
-- Hive Template Importer — initial schema
--
-- Relational model of a Spectora-style template:
--   templates -> sections -> items -> comments
--
-- Rich content (links, formatting, images) lives inside comments.body_html.
-- Everything else is normalized and individually editable. No opaque blobs.
-- ===========================================================================

create extension if not exists "pgcrypto";

create table if not exists public.templates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  source          text,
  copied_from_id  uuid references public.templates(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.sections (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid not null references public.templates(id) on delete cascade,
  name         text not null default '',
  position     integer not null default 0
);

create table if not exists public.items (
  id           uuid primary key default gen_random_uuid(),
  section_id   uuid not null references public.sections(id) on delete cascade,
  name         text not null default '',
  position     integer not null default 0
);

create table if not exists public.comments (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null references public.items(id) on delete cascade,
  name            text not null default '',
  body_html       text not null default '',
  type            text not null default 'unknown',
  severity        text not null default 'none',
  recommendation  text,
  options         jsonb not null default '[]'::jsonb,
  position        integer not null default 0,
  extra           jsonb not null default '{}'::jsonb
);

create index if not exists sections_template_id_idx on public.sections(template_id);
create index if not exists items_section_id_idx     on public.items(section_id);
create index if not exists comments_item_id_idx      on public.comments(item_id);

-- ---------------------------------------------------------------------------
-- Row Level Security.
--
-- This app reaches the database only from the server using the service_role key
-- (which bypasses RLS). We therefore enable RLS and add NO permissive policies,
-- so the public anon/authenticated roles cannot read or write directly. This
-- keeps the data private by default. If you later add browser-side auth, add
-- policies scoped to auth.uid().
-- ---------------------------------------------------------------------------
alter table public.templates enable row level security;
alter table public.sections  enable row level security;
alter table public.items     enable row level security;
alter table public.comments  enable row level security;
