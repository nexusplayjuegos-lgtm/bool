create extension if not exists pgcrypto;

create table if not exists public.rooms (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  name text not null,
  status text not null default 'waiting' check (status in ('waiting', 'playing', 'finished')),
  game_mode text not null default 'brazilian',
  max_players int not null default 2,
  current_players int not null default 1,
  game_state jsonb not null default '{}'::jsonb,
  winner_id uuid references auth.users(id),
  expires_at timestamptz not null default now() + interval '2 hours'
);

create table if not exists public.room_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  player_number int not null check (player_number in (1, 2)),
  is_ready boolean not null default false,
  unique (room_id, user_id),
  unique (room_id, player_number)
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid references public.rooms(id) on delete set null,
  started_at timestamptz,
  ended_at timestamptz,
  winner_id uuid references auth.users(id),
  final_score jsonb,
  replay_data jsonb
);

alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.matches enable row level security;

drop policy if exists "Rooms visible for everyone" on public.rooms;
create policy "Rooms visible for everyone"
  on public.rooms
  for select
  using (true);

drop policy if exists "Authenticated users can create rooms" on public.rooms;
create policy "Authenticated users can create rooms"
  on public.rooms
  for insert
  to authenticated
  with check (created_by = auth.uid());

drop policy if exists "Room creator can update room" on public.rooms;
create policy "Room creator can update room"
  on public.rooms
  for update
  to authenticated
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

drop policy if exists "Room creator can delete room" on public.rooms;
create policy "Room creator can delete room"
  on public.rooms
  for delete
  to authenticated
  using (created_by = auth.uid());

drop policy if exists "Room players visible for everyone" on public.room_players;
create policy "Room players visible for everyone"
  on public.room_players
  for select
  using (true);

drop policy if exists "Authenticated users can join room" on public.room_players;
create policy "Authenticated users can join room"
  on public.room_players
  for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Player can update own presence" on public.room_players;
create policy "Player can update own presence"
  on public.room_players
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Player can leave own room" on public.room_players;
create policy "Player can leave own room"
  on public.room_players
  for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Matches visible for everyone" on public.matches;
create policy "Matches visible for everyone"
  on public.matches
  for select
  using (true);

drop policy if exists "Authenticated users can create matches" on public.matches;
create policy "Authenticated users can create matches"
  on public.matches
  for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update matches" on public.matches;
create policy "Authenticated users can update matches"
  on public.matches
  for update
  to authenticated
  using (true)
  with check (true);

alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.room_players;
