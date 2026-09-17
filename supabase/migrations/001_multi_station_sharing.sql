-- NexusNet multi-station collaboration schema.
-- Run this in the Supabase SQL editor after creating Station A and Station B
-- users in Authentication. Raw FIR files are not stored here; this registry
-- contains the extracted case record used for authorised cross-station search.

create table if not exists public.station_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  station_id text not null unique,
  station_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.shared_cases (
  case_id text primary key,
  fir_number text not null,
  crime_type text not null default '',
  district text not null default '',
  state text not null default '',
  date_filed text not null default '',
  status text not null default 'Active' check (status in ('Active', 'Under Review', 'Closed')),
  summary text not null default '',
  station_id text not null references public.station_members(station_id),
  station_name text not null,
  source_filename text not null default '',
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  uploaded_at timestamptz not null default now()
);

alter table public.shared_cases
  add column if not exists dataset_payload jsonb not null default '{}'::jsonb;

create table if not exists public.shared_case_access_log (
  access_id bigint generated always as identity primary key,
  case_id text not null references public.shared_cases(case_id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id),
  station_id text not null,
  accessed_at timestamptz not null default now()
);

alter table public.station_members enable row level security;
alter table public.shared_cases enable row level security;
alter table public.shared_case_access_log enable row level security;

drop policy if exists "members can read their own station profile" on public.station_members;
create policy "members can read their own station profile"
  on public.station_members for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "authenticated stations can search shared cases" on public.shared_cases;
create policy "authenticated stations can search shared cases"
  on public.shared_cases for select to authenticated
  using (true);

drop policy if exists "stations can publish their own cases" on public.shared_cases;
create policy "stations can publish their own cases"
  on public.shared_cases for insert to authenticated
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.station_members member
      where member.user_id = auth.uid()
        and member.station_id = shared_cases.station_id
        and member.station_name = shared_cases.station_name
    )
  );

drop policy if exists "stations can update their own cases" on public.shared_cases;
create policy "stations can update their own cases"
  on public.shared_cases for update to authenticated
  using (uploaded_by = auth.uid())
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1 from public.station_members member
      where member.user_id = auth.uid()
        and member.station_id = shared_cases.station_id
        and member.station_name = shared_cases.station_name
    )
  );

drop policy if exists "stations can create their own access log" on public.shared_case_access_log;
create policy "stations can create their own access log"
  on public.shared_case_access_log for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.station_members member
      where member.user_id = auth.uid()
        and member.station_id = shared_case_access_log.station_id
    )
  );

drop policy if exists "stations can read their own access log" on public.shared_case_access_log;
create policy "stations can read their own access log"
  on public.shared_case_access_log for select to authenticated
  using (user_id = auth.uid());

create or replace function public.get_shared_case(p_case_id text)
returns setof public.shared_cases
language plpgsql
security invoker
set search_path = public
as $$
declare
  requester_station text;
begin
  select station_id into requester_station
  from public.station_members
  where user_id = auth.uid();

  if requester_station is null then
    raise exception 'Authorised station membership is required';
  end if;

  insert into public.shared_case_access_log (case_id, user_id, station_id)
  select item.case_id, auth.uid(), requester_station
  from public.shared_cases item
  where item.case_id = p_case_id;

  return query
  select item.* from public.shared_cases item where item.case_id = p_case_id;
end;
$$;

revoke all on function public.get_shared_case(text) from public;
grant select on public.station_members to authenticated;
grant select, insert, update on public.shared_cases to authenticated;
grant select, insert on public.shared_case_access_log to authenticated;
grant usage, select on sequence public.shared_case_access_log_access_id_seq to authenticated;
grant execute on function public.get_shared_case(text) to authenticated;

-- After creating the two Supabase Auth users, register their real UUIDs:
-- insert into public.station_members (user_id, station_id, station_name) values
--   ('STATION_A_AUTH_USER_UUID', 'station-a', 'Station A'),
--   ('STATION_B_AUTH_USER_UUID', 'station-b', 'Station B');
