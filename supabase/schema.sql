create table if not exists public.player_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  level int not null default 1,
  xp numeric not null default 0,
  xp_to_next numeric not null default 50,
  base_max_hp numeric not null default 100,
  skill_points int not null default 2,
  allocated_skills jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.player_saves enable row level security;

create policy "Users can view own save"
  on public.player_saves for select
  using (auth.uid() = user_id);

create policy "Users can insert own save"
  on public.player_saves for insert
  with check (auth.uid() = user_id);

create policy "Users can update own save"
  on public.player_saves for update
  using (auth.uid() = user_id);
