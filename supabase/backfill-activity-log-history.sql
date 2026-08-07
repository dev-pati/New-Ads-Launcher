-- Backfill measurable work created before activity_log existed.
-- Safe to rerun: each reconstructed event has a stable object id and is inserted once.

begin;

with historical_actions as (
  -- A Portal assignment also creates a creative row. Count the assignment, not a
  -- second synthetic upload for the same user action.
  select
    c.org_id,
    c.user_id as actor_id,
    coalesce(nullif(a.full_name, ''), split_part(a.email, '@', 1), 'Unknown') as actor_name,
    'creative'::text as object_type,
    c.id::text as object_id,
    c.file_name as object_name,
    'created'::text as action,
    c.created_at
  from ads_launcher.creatives c
  join ads_launcher.accounts a on a.id = c.user_id
  where c.created_at is not null
    and not exists (
      select 1
      from ads_launcher.portal_media_assignments p
      where p.creative_id = c.id
    )

  union all

  -- One Portal API request can assign many assets. Rows created in the same second
  -- are reconstructed as one action, matching today's batch-level event.
  select
    p.org_id,
    p.assigned_by as actor_id,
    coalesce(nullif(a.full_name, ''), split_part(a.email, '@', 1), 'Unknown') as actor_name,
    'media_assignment'::text as object_type,
    'history:' || md5(concat_ws('|', p.org_id::text, p.assigned_by::text, p.ad_account_id, extract(epoch from date_trunc('second', p.created_at))::bigint::text)) as object_id,
    concat(count(*), ' asset(s) to ', p.ad_account_id) as object_name,
    'assigned'::text as action,
    min(p.created_at) as created_at
  from ads_launcher.portal_media_assignments p
  join ads_launcher.accounts a on a.id = p.assigned_by
  where p.created_at is not null
    -- Live Portal events use a batch/job id instead of assignment row ids. Only
    -- reconstruct rows older than the first real activity event to avoid double count.
    and p.created_at < coalesce(
      (select min(l.created_at) from ads_launcher.activity_log l where l.source <> 'history_backfill'),
      'infinity'::timestamptz
    )
  group by p.org_id, p.assigned_by, a.full_name, a.email, p.ad_account_id, date_trunc('second', p.created_at)

  union all

  select
    t.org_id,
    t.user_id as actor_id,
    coalesce(nullif(a.full_name, ''), split_part(a.email, '@', 1), 'Unknown') as actor_name,
    'template'::text as object_type,
    t.id::text as object_id,
    t.name as object_name,
    'created'::text as action,
    t.created_at
  from ads_launcher.ad_copy_templates t
  join ads_launcher.accounts a on a.id = t.user_id
  where t.created_at is not null

  union all

  select
    d.org_id,
    d.user_id as actor_id,
    coalesce(nullif(a.full_name, ''), nullif(d.user_name, ''), split_part(a.email, '@', 1), 'Unknown') as actor_name,
    'draft'::text as object_type,
    d.id::text as object_id,
    d.name as object_name,
    'created'::text as action,
    d.created_at
  from ads_launcher.launch_drafts d
  join ads_launcher.accounts a on a.id = d.user_id
  where d.created_at is not null
)
insert into ads_launcher.activity_log (
  org_id,
  actor_id,
  actor_name,
  object_type,
  object_id,
  object_name,
  action,
  source,
  created_at
)
select
  h.org_id,
  h.actor_id,
  h.actor_name,
  h.object_type,
  h.object_id,
  h.object_name,
  h.action,
  'history_backfill',
  h.created_at
from historical_actions h
where not exists (
  select 1
  from ads_launcher.activity_log existing
  where existing.org_id = h.org_id
    and existing.object_type = h.object_type
    and existing.object_id = h.object_id
    and existing.action = h.action
);

-- ponytail: updates, Meta edits, preset/automation creation, and request transitions
-- cannot be recovered without actor-stamped append-only rows. Keep live emits; add
-- source-specific audit tables only when those historical metrics become required.

do $$
begin
  if exists (
    select 1
    from ads_launcher.activity_log
    where source = 'history_backfill'
    group by org_id, object_type, object_id, action
    having count(*) > 1
  ) then
    raise exception 'history_backfill produced duplicate actions';
  end if;
end
$$;

commit;

-- Verification: reconstructed counts and covered date range.
select object_type, action, count(*) as action_count
from ads_launcher.activity_log
where source = 'history_backfill'
group by object_type, action
order by object_type, action;

select min(created_at) as earliest_action, max(created_at) as latest_action
from ads_launcher.activity_log
where source = 'history_backfill';
