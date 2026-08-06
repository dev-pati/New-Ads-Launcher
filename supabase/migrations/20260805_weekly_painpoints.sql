-- The weekly feedback loop, in the shape people actually answer.
--
-- One row per person per ISO week. The long note is optional; the structured answers
-- are the ones that produce a number. Every fallback *occurrence* lives in
-- meta_fallback_events instead — a count you cannot drill into is a rumour.

set search_path = ads_launcher, public;

create table if not exists weekly_painpoints (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references accounts(id) on delete cascade,
  week_start date not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  unique (org_id, user_id, week_start)
);

-- Structured answers. Added after the first cut of this table, so they are additive:
-- an existing row keeps its note and simply has no answers yet.
--
-- creative_aggregate: does the aggregated creative view do the job — 'works' | 'not_yet'.
--   null means unanswered, which is not the same as 'not_yet'.
-- spot_check_matched / spot_check_total: "X of 5 numbers I checked matched Meta".
--   null means nobody checked this week — never render it as 0/5.
alter table weekly_painpoints add column if not exists creative_aggregate text;
alter table weekly_painpoints add column if not exists spot_check_matched int;
alter table weekly_painpoints add column if not exists spot_check_total int not null default 5;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'weekly_painpoints_creative_aggregate_check') then
    alter table weekly_painpoints
      add constraint weekly_painpoints_creative_aggregate_check
      check (creative_aggregate is null or creative_aggregate in ('works', 'not_yet'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'weekly_painpoints_spot_check_range') then
    alter table weekly_painpoints
      add constraint weekly_painpoints_spot_check_range
      check (
        spot_check_total between 1 and 20
        and (spot_check_matched is null or spot_check_matched between 0 and spot_check_total)
      );
  end if;
end $$;

alter table weekly_painpoints enable row level security;

drop policy if exists "Users can read own weekly painpoints" on weekly_painpoints;
create policy "Users can read own weekly painpoints"
  on weekly_painpoints for select
  using (user_id = current_account_id() and is_org_member(org_id));

drop policy if exists "Users can insert own weekly painpoints" on weekly_painpoints;
create policy "Users can insert own weekly painpoints"
  on weekly_painpoints for insert
  with check (user_id = current_account_id() and is_org_member(org_id));

drop policy if exists "Users can update own weekly painpoints" on weekly_painpoints;
create policy "Users can update own weekly painpoints"
  on weekly_painpoints for update
  using (user_id = current_account_id() and is_org_member(org_id))
  with check (user_id = current_account_id() and is_org_member(org_id));

create index if not exists weekly_painpoints_org_week_idx
  on weekly_painpoints (org_id, week_start desc);
