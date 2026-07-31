set search_path = ads_launcher, public;

drop policy if exists "Org members can view launch batches" on launch_batches;
create policy "Org members can view launch batches"
  on launch_batches
  for select
  to authenticated
  using (is_org_member(org_id));

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'ads_launcher'
      and tablename = 'launch_batches'
  ) then
    alter publication supabase_realtime add table ads_launcher.launch_batches;
  end if;
end
$$;
