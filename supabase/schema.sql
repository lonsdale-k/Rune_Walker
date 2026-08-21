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
alter table public.player_saves add column if not exists coins numeric not null default 0;
alter table public.player_saves add column if not exists cleared_stages jsonb not null default '[]'::jsonb;
alter table public.player_saves add column if not exists owned_cosmetics jsonb not null default '[]'::jsonb;
alter table public.player_saves add column if not exists equipped_cosmetics jsonb not null default '{}'::jsonb;
-- 전투 장비(equipment.js) — 코스메틱과 별개로 실제 스탯에 영향을 주는 드랍 아이템 저장용
alter table public.player_saves add column if not exists owned_gear jsonb not null default '[]'::jsonb;
alter table public.player_saves add column if not exists equipped_gear jsonb not null default '{}'::jsonb;
-- 출석 이벤트(하루 한 번 보상) — 마지막으로 보상을 받은 날짜와 연속 출석일수
alter table public.player_saves add column if not exists last_claim_date date;
alter table public.player_saves add column if not exists login_streak int not null default 0;
-- 펫(pets.js) — 코스메틱/장비와 별개로 보유·장착·레벨(경험치)을 저장
alter table public.player_saves add column if not exists owned_pets jsonb not null default '[]'::jsonb;
alter table public.player_saves add column if not exists equipped_pet text;
alter table public.player_saves add column if not exists pet_levels jsonb not null default '{}'::jsonb;
alter table public.player_saves add column if not exists pet_xp jsonb not null default '{}'::jsonb;

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

-- 명예의 전당(랭킹) — player_saves는 본인만 조회 가능한 RLS라 그대로는 다른 플레이어 순위를 볼 수 없다.
-- 순위 표시에 필요한 최소 필드(닉네임/레벨/코인)만 담아 누구나 읽을 수 있는 별도 테이블로 분리한다.
-- "가벼운 멀티플레이" 용도 — 실시간 동기화가 아니라 저장 시점마다 이 테이블도 함께 갱신(upsert)하는 방식.
create table if not exists public.leaderboard (
  user_id uuid primary key references auth.users(id) on delete cascade,
  username text not null,
  level int not null default 1,
  coins numeric not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.leaderboard enable row level security;

create policy "Anyone can view leaderboard"
  on public.leaderboard for select
  using (true);

create policy "Users can insert own leaderboard row"
  on public.leaderboard for insert
  with check (auth.uid() = user_id);

create policy "Users can update own leaderboard row"
  on public.leaderboard for update
  using (auth.uid() = user_id);
