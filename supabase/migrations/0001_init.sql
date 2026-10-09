create extension if not exists citext;

create table players (
  id uuid primary key default gen_random_uuid(),
  name citext not null unique check (length(btrim(name)) > 0),
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table game_tables (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) > 0),
  buy_in_amount integer not null default 500 check (buy_in_amount > 0),
  status text not null default 'open' check (status in ('open','closed')),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table table_players (
  id uuid primary key default gen_random_uuid(),
  table_id uuid not null references game_tables(id) on delete cascade,
  player_id uuid not null references players(id) on delete restrict,
  cash_out integer check (cash_out >= 0),
  joined_at timestamptz not null default now(),
  unique (table_id, player_id)
);

create table buyin_transactions (
  id uuid primary key default gen_random_uuid(),
  table_player_id uuid not null references table_players(id) on delete cascade,
  amount integer not null check (amount <> 0),
  created_at timestamptz not null default now()
);

create index table_players_table_id_idx on table_players(table_id);
create index table_players_player_id_idx on table_players(player_id);
create index buyin_transactions_table_player_id_idx on buyin_transactions(table_player_id);
create index game_tables_status_idx on game_tables(status);

-- Views
create view table_player_summary with (security_invoker = true) as
select
  tp.id as table_player_id,
  tp.table_id,
  tp.player_id,
  p.name::text as player_name,
  coalesce(sum(bt.amount), 0)::integer as total_buyin,
  coalesce(sum(sign(bt.amount)), 0)::integer as buyin_count,
  tp.cash_out,
  case when tp.cash_out is null then null
       else tp.cash_out - coalesce(sum(bt.amount), 0)::integer end as net,
  tp.joined_at
from table_players tp
join players p on p.id = tp.player_id
left join buyin_transactions bt on bt.table_player_id = tp.id
group by tp.id, p.id;

revoke all on table_player_summary from anon;
grant select on table_player_summary to authenticated;

create view overall_leaderboard as
with per_table as (
  select
    tp.player_id,
    tp.table_id,
    coalesce(sum(bt.amount), 0)::integer as buyin,
    coalesce(tp.cash_out, 0) as cash_out
  from table_players tp
  join game_tables gt on gt.id = tp.table_id and gt.status = 'closed'
  left join buyin_transactions bt on bt.table_player_id = tp.id
  group by tp.id
)
select
  p.id as player_id,
  p.name::text as player_name,
  count(*)::integer as tables_played,
  sum(pt.buyin)::integer as total_buyin,
  sum(pt.cash_out)::integer as total_cash_out,
  (sum(pt.cash_out) - sum(pt.buyin))::integer as net,
  max(pt.cash_out - pt.buyin) filter (where pt.cash_out - pt.buyin > 0)::integer as biggest_win
from per_table pt
join players p on p.id = pt.player_id
group by p.id;

revoke all on overall_leaderboard from anon, authenticated;
grant select on overall_leaderboard to anon, authenticated;

-- RLS
alter table players enable row level security;
alter table game_tables enable row level security;
alter table table_players enable row level security;
alter table buyin_transactions enable row level security;

create policy players_all on players for all to authenticated using (true) with check (true);
create policy game_tables_all on game_tables for all to authenticated using (true) with check (true);
create policy table_players_all on table_players for all to authenticated using (true) with check (true);
create policy buyin_transactions_all on buyin_transactions for all to authenticated using (true) with check (true);

-- Functions
create function create_table(p_name text, p_buy_in_amount integer default 500)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_id uuid;
begin
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'Table name is required';
  end if;
  if p_buy_in_amount is null or p_buy_in_amount <= 0 then
    raise exception 'Buy-in amount must be a positive whole number';
  end if;
  insert into game_tables (name, buy_in_amount) values (btrim(p_name), p_buy_in_amount)
  returning id into v_id;
  return v_id;
end $$;

create function create_player(p_name text)
returns players language plpgsql security invoker set search_path = public as $$
declare v_row players;
begin
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'Player name is required';
  end if;
  begin
    insert into players (name) values (btrim(p_name)) returning * into v_row;
  exception when unique_violation then
    raise exception 'Player "%" already exists', btrim(p_name);
  end;
  return v_row;
end $$;

create function rename_player(p_player_id uuid, p_name text)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if p_name is null or length(btrim(p_name)) = 0 then
    raise exception 'Player name is required';
  end if;
  begin
    update players set name = btrim(p_name) where id = p_player_id;
  exception when unique_violation then
    raise exception 'Player "%" already exists', btrim(p_name);
  end;
  if not found then
    raise exception 'Player not found';
  end if;
end $$;

create function set_player_archived(p_player_id uuid, p_archived boolean)
returns void language plpgsql security invoker set search_path = public as $$
begin
  update players set is_archived = coalesce(p_archived, false) where id = p_player_id;
  if not found then
    raise exception 'Player not found';
  end if;
end $$;

create function seat_player(p_table_id uuid, p_player_id uuid)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_table game_tables;
  v_player players;
  v_tp_id uuid;
begin
  select * into v_table from game_tables where id = p_table_id for update;
  if not found then
    raise exception 'Table not found';
  end if;
  if v_table.status = 'closed' then
    raise exception 'Table is closed';
  end if;
  select * into v_player from players where id = p_player_id;
  if not found then
    raise exception 'Player not found';
  end if;
  if v_player.is_archived then
    raise exception 'Player "%" is archived', v_player.name;
  end if;
  if exists (select 1 from table_players where table_id = p_table_id and player_id = p_player_id) then
    raise exception 'Player is already seated';
  end if;
  insert into table_players (table_id, player_id) values (p_table_id, p_player_id)
  returning id into v_tp_id;
  insert into buyin_transactions (table_player_id, amount) values (v_tp_id, v_table.buy_in_amount);
  return v_tp_id;
end $$;

create function add_and_seat_player(p_table_id uuid, p_name text)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_name text := btrim(coalesce(p_name, ''));
  v_status text;
  v_player_id uuid;
begin
  if length(v_name) = 0 then
    raise exception 'Player name is required';
  end if;
  select status into v_status from game_tables where id = p_table_id for update;
  if not found then
    raise exception 'Table not found';
  end if;
  if v_status = 'closed' then
    raise exception 'Table is closed';
  end if;
  insert into players (name) values (v_name)
  on conflict (name) do update set is_archived = false
  returning id into v_player_id;
  return seat_player(p_table_id, v_player_id);
end $$;

create function change_buyin(p_table_player_id uuid, p_direction integer)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_table_id uuid;
  v_table game_tables;
  v_total integer;
begin
  if p_direction is null or p_direction not in (1, -1) then
    raise exception 'Direction must be 1 or -1';
  end if;
  select table_id into v_table_id from table_players where id = p_table_player_id;
  if not found then
    raise exception 'Seat not found';
  end if;
  select * into v_table from game_tables where id = v_table_id for update;
  if v_table.status = 'closed' then
    raise exception 'Table is closed';
  end if;
  select coalesce(sum(amount), 0) into v_total from buyin_transactions where table_player_id = p_table_player_id;
  if v_total + p_direction * v_table.buy_in_amount < v_table.buy_in_amount then
    raise exception 'Cannot go below 1 buy-in';
  end if;
  insert into buyin_transactions (table_player_id, amount)
  values (p_table_player_id, p_direction * v_table.buy_in_amount);
end $$;

create function remove_table_player(p_table_player_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_tp table_players;
  v_table game_tables;
  v_total integer;
begin
  select * into v_tp from table_players where id = p_table_player_id;
  if not found then
    raise exception 'Seat not found';
  end if;
  select * into v_table from game_tables where id = v_tp.table_id for update;
  if v_table.status = 'closed' then
    raise exception 'Table is closed';
  end if;
  select coalesce(sum(amount), 0) into v_total from buyin_transactions where table_player_id = p_table_player_id;
  if v_total <> v_table.buy_in_amount then
    raise exception 'Only players with exactly 1 buy-in can be removed';
  end if;
  if v_tp.cash_out is not null then
    raise exception 'Cannot remove a player who has a cash-out';
  end if;
  delete from table_players where id = p_table_player_id;
end $$;

create function set_cash_out(p_table_player_id uuid, p_amount integer)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_table_id uuid;
  v_status text;
begin
  if p_amount is not null and p_amount < 0 then
    raise exception 'Cash-out cannot be negative';
  end if;
  select table_id into v_table_id from table_players where id = p_table_player_id;
  if not found then
    raise exception 'Seat not found';
  end if;
  select status into v_status from game_tables where id = v_table_id for update;
  if v_status = 'closed' then
    raise exception 'Table is closed';
  end if;
  update table_players set cash_out = p_amount where id = p_table_player_id;
end $$;

create function close_table(p_table_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare
  v_status text;
  v_count integer;
  v_missing text;
begin
  select status into v_status from game_tables where id = p_table_id for update;
  if not found then
    raise exception 'Table not found';
  end if;
  if v_status = 'closed' then
    raise exception 'Table is closed';
  end if;
  select count(*) into v_count from table_players where table_id = p_table_id;
  if v_count = 0 then
    raise exception 'Table has no players';
  end if;
  select string_agg(p.name::text, ', ' order by p.name) into v_missing
  from table_players tp join players p on p.id = tp.player_id
  where tp.table_id = p_table_id and tp.cash_out is null;
  if v_missing is not null then
    raise exception 'Missing cash-out for: %', v_missing;
  end if;
  update game_tables set status = 'closed', closed_at = now() where id = p_table_id;
end $$;

create function reopen_table(p_table_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_status text;
begin
  select status into v_status from game_tables where id = p_table_id for update;
  if not found then
    raise exception 'Table not found';
  end if;
  update game_tables set status = 'open', closed_at = null where id = p_table_id;
end $$;

revoke execute on function
  create_table(text, integer), create_player(text), rename_player(uuid, text),
  set_player_archived(uuid, boolean), seat_player(uuid, uuid), add_and_seat_player(uuid, text),
  change_buyin(uuid, integer), remove_table_player(uuid), set_cash_out(uuid, integer),
  close_table(uuid), reopen_table(uuid)
from public, anon;
grant execute on function
  create_table(text, integer), create_player(text), rename_player(uuid, text),
  set_player_archived(uuid, boolean), seat_player(uuid, uuid), add_and_seat_player(uuid, text),
  change_buyin(uuid, integer), remove_table_player(uuid), set_cash_out(uuid, integer),
  close_table(uuid), reopen_table(uuid)
to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table table_players, buyin_transactions, game_tables;
  end if;
end $$;
