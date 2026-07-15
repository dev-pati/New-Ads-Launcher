-- ============================================================
-- Schema standardization for company-wide multi-tenant use
-- - Ensure 6-role RBAC helpers exist (current_account_id lineage)
-- - Add missing org_id FKs on page-manager tables
-- - Replace soft-fail RLS policy creation with hard requirements
-- ============================================================

set search_path = ads_launcher, public;

-- 1) Expand org_role enum (idempotent)
do $$
begin
  if exists (select 1 from pg_type t join pg_namespace n on n.oid = t.typnamespace
             where t.typname = 'org_role' and n.nspname = 'ads_launcher') then
    alter type ads_launcher.org_role add value if not exists 'launcher';
    alter type ads_launcher.org_role add value if not exists 'uploader';
    alter type ads_launcher.org_role add value if not exists 'analyst';
    alter type ads_launcher.org_role add value if not exists 'commenter';
  end if;
end $$;

-- 2) Require current_account_id / is_org_member (hard fail if missing)
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'current_account_id' and n.nspname = 'ads_launcher'
  ) then
    raise exception 'ads_launcher.current_account_id() is required before schema standardization';
  end if;

  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname = 'is_org_member' and n.nspname = 'ads_launcher'
  ) then
    raise exception 'ads_launcher.is_org_member() is required before schema standardization';
  end if;
end $$;

-- 3) Role helpers (custom-auth lineage: current_account_id)
create or replace function ads_launcher.can_edit_ads(check_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from ads_launcher.org_members
    where org_id = check_org_id
      and user_id = ads_launcher.current_account_id()
      and role in ('admin', 'editor', 'launcher')
  );
$$ language sql security definer stable;

create or replace function ads_launcher.can_delete_ads(check_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from ads_launcher.org_members
    where org_id = check_org_id
      and user_id = ads_launcher.current_account_id()
      and role in ('admin', 'editor')
  );
$$ language sql security definer stable;

create or replace function ads_launcher.can_upload_media(check_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from ads_launcher.org_members
    where org_id = check_org_id
      and user_id = ads_launcher.current_account_id()
      and role in ('admin', 'editor', 'launcher', 'uploader')
  );
$$ language sql security definer stable;

create or replace function ads_launcher.can_write_comments(check_org_id uuid)
returns boolean as $$
  select exists (
    select 1 from ads_launcher.org_members
    where org_id = check_org_id
      and user_id = ads_launcher.current_account_id()
      and role in ('admin', 'editor', 'launcher', 'uploader', 'commenter')
  );
$$ language sql security definer stable;

-- 4) Missing org FKs (only if tables exist + FK not already present)
do $$
declare
  t text;
  cname text;
begin
  foreach t in array array[
    'page_manager_settings',
    'page_manager_settings_audit_logs',
    'page_conversations',
    'page_messages',
    'page_manage_activity'
  ]
  loop
    if to_regclass('ads_launcher.' || t) is null then
      continue;
    end if;

    cname := t || '_org_id_fkey';
    if not exists (
      select 1 from pg_constraint
      where conname = cname
    ) then
      execute format(
        'alter table ads_launcher.%I
           add constraint %I
           foreign key (org_id) references ads_launcher.organizations(id) on delete cascade',
        t, cname
      );
    end if;
  end loop;
end $$;

-- 5) Hard RLS policies for page-manager tables (no soft-fail)
do $$
begin
  if to_regclass('ads_launcher.page_manager_settings') is not null then
    alter table ads_launcher.page_manager_settings enable row level security;
    drop policy if exists "Org members can view page manager settings" on ads_launcher.page_manager_settings;
    drop policy if exists "Org members can insert page manager settings" on ads_launcher.page_manager_settings;
    drop policy if exists "Org members can update page manager settings" on ads_launcher.page_manager_settings;
    drop policy if exists "Org members can delete page manager settings" on ads_launcher.page_manager_settings;
    create policy "Org members can view page manager settings" on ads_launcher.page_manager_settings for select using (ads_launcher.is_org_member(org_id));
    create policy "Org members can insert page manager settings" on ads_launcher.page_manager_settings for insert with check (ads_launcher.is_org_member(org_id));
    create policy "Org members can update page manager settings" on ads_launcher.page_manager_settings for update using (ads_launcher.is_org_member(org_id));
    create policy "Org members can delete page manager settings" on ads_launcher.page_manager_settings for delete using (ads_launcher.is_org_member(org_id));
  end if;

  if to_regclass('ads_launcher.page_manager_settings_audit_logs') is not null then
    alter table ads_launcher.page_manager_settings_audit_logs enable row level security;
    drop policy if exists "Org members can view page manager settings audit logs" on ads_launcher.page_manager_settings_audit_logs;
    drop policy if exists "Org members can insert page manager settings audit logs" on ads_launcher.page_manager_settings_audit_logs;
    create policy "Org members can view page manager settings audit logs" on ads_launcher.page_manager_settings_audit_logs for select using (ads_launcher.is_org_member(org_id));
    create policy "Org members can insert page manager settings audit logs" on ads_launcher.page_manager_settings_audit_logs for insert with check (ads_launcher.is_org_member(org_id));
  end if;

  if to_regclass('ads_launcher.page_conversations') is not null then
    alter table ads_launcher.page_conversations enable row level security;
    drop policy if exists "Org members can view page conversations" on ads_launcher.page_conversations;
    drop policy if exists "Org members can insert page conversations" on ads_launcher.page_conversations;
    drop policy if exists "Org members can update page conversations" on ads_launcher.page_conversations;
    create policy "Org members can view page conversations" on ads_launcher.page_conversations for select using (ads_launcher.is_org_member(org_id));
    create policy "Org members can insert page conversations" on ads_launcher.page_conversations for insert with check (ads_launcher.is_org_member(org_id));
    create policy "Org members can update page conversations" on ads_launcher.page_conversations for update using (ads_launcher.is_org_member(org_id));
  end if;

  if to_regclass('ads_launcher.page_messages') is not null then
    alter table ads_launcher.page_messages enable row level security;
    drop policy if exists "Org members can view page messages" on ads_launcher.page_messages;
    drop policy if exists "Org members can insert page messages" on ads_launcher.page_messages;
    create policy "Org members can view page messages" on ads_launcher.page_messages for select using (ads_launcher.is_org_member(org_id));
    create policy "Org members can insert page messages" on ads_launcher.page_messages for insert with check (ads_launcher.is_org_member(org_id));
  end if;

  if to_regclass('ads_launcher.page_manage_activity') is not null then
    alter table ads_launcher.page_manage_activity enable row level security;
    drop policy if exists "Org members can view page manage activity" on ads_launcher.page_manage_activity;
    drop policy if exists "Org members can insert page manage activity" on ads_launcher.page_manage_activity;
    create policy "Org members can view page manage activity" on ads_launcher.page_manage_activity for select using (ads_launcher.is_org_member(org_id));
    create policy "Org members can insert page manage activity" on ads_launcher.page_manage_activity for insert with check (ads_launcher.is_org_member(org_id));
  end if;
end $$;

-- 6) Core table write policies → 6-role helpers (safe drop/create)
do $$
begin
  -- creatives
  if to_regclass('ads_launcher.creatives') is not null then
    drop policy if exists "Org members can insert creatives" on ads_launcher.creatives;
    drop policy if exists "Org members can update creatives" on ads_launcher.creatives;
    drop policy if exists "Org admins can delete creatives" on ads_launcher.creatives;
    drop policy if exists "Can edit creatives insert" on ads_launcher.creatives;
    drop policy if exists "Can edit creatives update" on ads_launcher.creatives;
    drop policy if exists "Can delete creatives" on ads_launcher.creatives;
    create policy "Can edit creatives insert" on ads_launcher.creatives for insert with check (ads_launcher.can_edit_ads(org_id));
    create policy "Can edit creatives update" on ads_launcher.creatives for update using (ads_launcher.can_edit_ads(org_id));
    create policy "Can delete creatives" on ads_launcher.creatives for delete using (ads_launcher.can_delete_ads(org_id));
  end if;

  -- ads
  if to_regclass('ads_launcher.ads') is not null then
    drop policy if exists "Org members can insert ads" on ads_launcher.ads;
    drop policy if exists "Org members can update ads" on ads_launcher.ads;
    drop policy if exists "Org admins can delete ads" on ads_launcher.ads;
    drop policy if exists "Can edit ads insert" on ads_launcher.ads;
    drop policy if exists "Can edit ads update" on ads_launcher.ads;
    drop policy if exists "Can delete ads" on ads_launcher.ads;
    create policy "Can edit ads insert" on ads_launcher.ads for insert with check (ads_launcher.can_edit_ads(org_id));
    create policy "Can edit ads update" on ads_launcher.ads for update using (ads_launcher.can_edit_ads(org_id));
    create policy "Can delete ads" on ads_launcher.ads for delete using (ads_launcher.can_delete_ads(org_id));
  end if;

  -- ad_media
  if to_regclass('ads_launcher.ad_media') is not null then
    drop policy if exists "Org members can insert ad media" on ads_launcher.ad_media;
    drop policy if exists "Org admins can delete ad media" on ads_launcher.ad_media;
    drop policy if exists "Can upload ad media" on ads_launcher.ad_media;
    drop policy if exists "Can delete ad media" on ads_launcher.ad_media;
    create policy "Can upload ad media" on ads_launcher.ad_media for insert with check (ads_launcher.can_upload_media(org_id));
    create policy "Can delete ad media" on ads_launcher.ad_media for delete using (ads_launcher.can_delete_ads(org_id));
  end if;

  -- ad_set_presets / launch_batches / scheduled_activations / ad_copy_templates
  if to_regclass('ads_launcher.ad_set_presets') is not null then
    drop policy if exists "Org members can manage presets" on ads_launcher.ad_set_presets;
    drop policy if exists "Can edit ad set presets" on ads_launcher.ad_set_presets;
    create policy "Can edit ad set presets" on ads_launcher.ad_set_presets for all using (ads_launcher.can_edit_ads(org_id));
  end if;

  if to_regclass('ads_launcher.launch_batches') is not null then
    drop policy if exists "Org members can manage launch batches" on ads_launcher.launch_batches;
    drop policy if exists "Can edit launch batches" on ads_launcher.launch_batches;
    create policy "Can edit launch batches" on ads_launcher.launch_batches for all using (ads_launcher.can_edit_ads(org_id));
  end if;

  if to_regclass('ads_launcher.scheduled_activations') is not null then
    drop policy if exists "Org members can select scheduled activations" on ads_launcher.scheduled_activations;
    drop policy if exists "Org members can insert scheduled activations" on ads_launcher.scheduled_activations;
    drop policy if exists "Org members can update scheduled activations" on ads_launcher.scheduled_activations;
    drop policy if exists "Org members can delete scheduled activations" on ads_launcher.scheduled_activations;
    drop policy if exists "Can edit scheduled activations" on ads_launcher.scheduled_activations;
    drop policy if exists "Can edit scheduled activations insert" on ads_launcher.scheduled_activations;
    drop policy if exists "Can edit scheduled activations update" on ads_launcher.scheduled_activations;
    drop policy if exists "Can edit scheduled activations delete" on ads_launcher.scheduled_activations;
    create policy "Can edit scheduled activations" on ads_launcher.scheduled_activations for all using (ads_launcher.can_edit_ads(org_id));
  end if;

  if to_regclass('ads_launcher.ad_copy_templates') is not null then
    drop policy if exists "Org members can manage ad copy templates" on ads_launcher.ad_copy_templates;
    drop policy if exists "Can edit ad copy templates" on ads_launcher.ad_copy_templates;
    create policy "Can edit ad copy templates" on ads_launcher.ad_copy_templates for all using (ads_launcher.can_edit_ads(org_id));
  end if;

  -- comments
  if to_regclass('ads_launcher.comments') is not null then
    drop policy if exists "Org members can insert comments" on ads_launcher.comments;
    drop policy if exists "Org members can update comments" on ads_launcher.comments;
    drop policy if exists "Org members can delete comments" on ads_launcher.comments;
    drop policy if exists "Can write comments insert" on ads_launcher.comments;
    drop policy if exists "Can write comments update" on ads_launcher.comments;
    drop policy if exists "Can write comments delete" on ads_launcher.comments;
    create policy "Can write comments insert" on ads_launcher.comments for insert with check (ads_launcher.can_write_comments(org_id));
    create policy "Can write comments update" on ads_launcher.comments for update using (ads_launcher.can_write_comments(org_id));
    create policy "Can write comments delete" on ads_launcher.comments for delete using (ads_launcher.can_write_comments(org_id));
  end if;

  -- automations
  if to_regclass('ads_launcher.automations') is not null then
    drop policy if exists "Org members can manage automations" on ads_launcher.automations;
    drop policy if exists "Can edit automations" on ads_launcher.automations;
    create policy "Can edit automations" on ads_launcher.automations for all using (ads_launcher.can_edit_ads(org_id));
  end if;

  if to_regclass('ads_launcher.automation_executions') is not null then
    drop policy if exists "Org members can manage automation executions" on ads_launcher.automation_executions;
    drop policy if exists "Can edit automation executions" on ads_launcher.automation_executions;
    create policy "Can edit automation executions" on ads_launcher.automation_executions for all using (ads_launcher.can_edit_ads(org_id));
  end if;

  if to_regclass('ads_launcher.automation_approvals') is not null then
    drop policy if exists "Org members can manage automation approvals" on ads_launcher.automation_approvals;
    drop policy if exists "Can edit automation approvals" on ads_launcher.automation_approvals;
    create policy "Can edit automation approvals" on ads_launcher.automation_approvals for all using (ads_launcher.can_edit_ads(org_id));
  end if;

  if to_regclass('ads_launcher.budget_schedules') is not null then
    drop policy if exists "Org members can manage budget schedules" on ads_launcher.budget_schedules;
    drop policy if exists "Can edit budget schedules" on ads_launcher.budget_schedules;
    create policy "Can edit budget schedules" on ads_launcher.budget_schedules for all using (ads_launcher.can_edit_ads(org_id));
  end if;

  if to_regclass('ads_launcher.naming_schemas') is not null then
    drop policy if exists "Org members can insert naming schema" on ads_launcher.naming_schemas;
    drop policy if exists "Org members can update naming schema" on ads_launcher.naming_schemas;
    drop policy if exists "Can edit naming schema insert" on ads_launcher.naming_schemas;
    drop policy if exists "Can edit naming schema update" on ads_launcher.naming_schemas;
    create policy "Can edit naming schema insert" on ads_launcher.naming_schemas for insert with check (ads_launcher.can_edit_ads(org_id));
    create policy "Can edit naming schema update" on ads_launcher.naming_schemas for update using (ads_launcher.can_edit_ads(org_id));
  end if;
end $$;
