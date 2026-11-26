-- WAYPOINT v2: additive relational travel workspace.
-- Existing public.trips JSONB columns are intentionally retained for backward compatibility.
create table if not exists public.trip_days (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_date date not null,
  position integer not null default 0,
  theme text not null default '',
  created_at timestamptz not null default now(),
  unique (trip_id, day_date),
  unique (id, trip_id)
);

create table if not exists public.trip_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  day_id uuid not null,
  position integer not null default 0,
  place_id text,
  name text not null,
  category text not null default 'place',
  address text,
  latitude double precision,
  longitude double precision,
  start_time time,
  end_time time,
  note text not null default '',
  planned_cost numeric(14,2) not null default 0 check (planned_cost >= 0),
  currency char(3) not null default 'KRW',
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_stops_day_trip_fk foreign key (day_id, trip_id)
    references public.trip_days(id, trip_id) on delete cascade,
  unique (id, trip_id)
);

create table if not exists public.trip_reservations (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  reservation_type text not null check (reservation_type in ('flight','hotel','rail','bus','car','activity','other')),
  provider text not null default '',
  confirmation_code text not null default '',
  title text not null default '',
  origin text,
  destination text,
  flight_number text,
  departure_at timestamptz,
  arrival_at timestamptz,
  check_in_at timestamptz,
  check_out_at timestamptz,
  status text not null default 'planned',
  price numeric(14,2) check (price is null or price >= 0),
  currency char(3) not null default 'KRW',
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_expenses (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  stop_id uuid,
  reservation_id uuid references public.trip_reservations(id) on delete set null,
  title text not null,
  category text not null default 'other',
  amount numeric(14,2) not null check (amount >= 0),
  currency char(3) not null default 'KRW',
  amount_krw numeric(14,2) not null check (amount_krw >= 0),
  exchange_rate numeric(18,8) not null default 1 check (exchange_rate > 0),
  rate_date date,
  paid_by text not null default '',
  split_type text not null default 'equal' check (split_type in ('equal','payer')),
  spent_at date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_expenses_stop_trip_fk foreign key (stop_id, trip_id)
    references public.trip_stops(id, trip_id) on delete set null
);

create table if not exists public.trip_checklist_items (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  category text not null default 'tasks',
  title text not null,
  is_done boolean not null default false,
  priority text not null default 'normal' check (priority in ('high','normal','low')),
  due_at date,
  assigned_to text not null default '',
  note text not null default '',
  source text not null default 'manual' check (source in ('template','auto','manual')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_notes (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  stop_id uuid,
  title text not null default '',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint trip_notes_stop_trip_fk foreign key (stop_id, trip_id)
    references public.trip_stops(id, trip_id) on delete set null
);

create index if not exists trip_days_trip_position_idx on public.trip_days(trip_id, position);
create index if not exists trip_stops_day_position_idx on public.trip_stops(day_id, position);
create index if not exists trip_reservations_trip_time_idx on public.trip_reservations(trip_id, departure_at);
create index if not exists trip_expenses_trip_date_idx on public.trip_expenses(trip_id, spent_at desc);
create index if not exists trip_checklist_trip_done_idx on public.trip_checklist_items(trip_id, is_done, position);
create index if not exists trip_notes_trip_updated_idx on public.trip_notes(trip_id, updated_at desc);

alter table public.trip_days enable row level security;
alter table public.trip_stops enable row level security;
alter table public.trip_reservations enable row level security;
alter table public.trip_expenses enable row level security;
alter table public.trip_checklist_items enable row level security;
alter table public.trip_notes enable row level security;

grant select, insert, update, delete on public.trip_days to authenticated;
grant select, insert, update, delete on public.trip_stops to authenticated;
grant select, insert, update, delete on public.trip_reservations to authenticated;
grant select, insert, update, delete on public.trip_expenses to authenticated;
grant select, insert, update, delete on public.trip_checklist_items to authenticated;
grant select, insert, update, delete on public.trip_notes to authenticated;

create policy "trip_days_owner_all" on public.trip_days for all to authenticated
using (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())))
with check (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())));

create policy "trip_stops_owner_all" on public.trip_stops for all to authenticated
using (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())))
with check (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())));

create policy "trip_reservations_owner_all" on public.trip_reservations for all to authenticated
using (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())))
with check (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())));

create policy "trip_expenses_owner_all" on public.trip_expenses for all to authenticated
using (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())))
with check (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())));

create policy "trip_checklist_owner_all" on public.trip_checklist_items for all to authenticated
using (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())))
with check (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())));

create policy "trip_notes_owner_all" on public.trip_notes for all to authenticated
using (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())))
with check (exists (select 1 from public.trips t where t.id = trip_id and t.user_id = (select auth.uid())));
