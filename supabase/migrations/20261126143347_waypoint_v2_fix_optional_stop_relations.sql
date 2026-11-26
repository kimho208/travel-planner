-- Keep trip_id non-null when a linked stop is deleted.
alter table public.trip_expenses drop constraint if exists trip_expenses_stop_trip_fk;
alter table public.trip_expenses
  add constraint trip_expenses_stop_id_fkey
  foreign key (stop_id) references public.trip_stops(id) on delete set null;

alter table public.trip_notes drop constraint if exists trip_notes_stop_trip_fk;
alter table public.trip_notes
  add constraint trip_notes_stop_id_fkey
  foreign key (stop_id) references public.trip_stops(id) on delete set null;

create index if not exists trip_stops_trip_day_idx on public.trip_stops(trip_id, day_id, position);
create index if not exists trip_expenses_reservation_idx on public.trip_expenses(reservation_id);
create index if not exists trip_expenses_stop_idx on public.trip_expenses(stop_id);
create index if not exists trip_notes_stop_idx on public.trip_notes(stop_id);
