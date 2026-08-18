create table if not exists public.player_saves (
  user_id uuid primary key references auth.users(id) on delete cascade,
  level int not null default 1,
  xp numeric not null default 0,
  xp_to_next numeric not null default 50,
  base_max_hp numeric not null default 100,
  skill_points int not null default 2,
  allocated_skills jsonb not null default '[]'::jsonb,
  defeated_bosses jsonb not null default '[]'::jsonb,
  colosseum_cleared boolean not null default false,
  updated_at timestamptz not null default now()
);

-- 기존에 이미 만들어진 테이블에는 위 create table이 적용되지 않으므로 아래 alter문으로 컬럼을 추가한다
alter table public.player_saves add column if not exists defeated_bosses jsonb not null default '[]'::jsonb;
alter table public.player_saves add column if not exists colosseum_cleared boolean not null default false;

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
