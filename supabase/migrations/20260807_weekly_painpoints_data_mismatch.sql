-- Count occasions where an AdLauncher value did not match Meta Ads Manager.

alter table ads_launcher.weekly_painpoints
  add column if not exists data_mismatch_count integer;

-- Preserve old X-of-N spot checks as their equivalent mismatch count.
update ads_launcher.weekly_painpoints
set data_mismatch_count = greatest(0, spot_check_total - spot_check_matched)
where data_mismatch_count is null
  and spot_check_matched is not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'weekly_painpoints_data_mismatch_count_check'
      and conrelid = 'ads_launcher.weekly_painpoints'::regclass
  ) then
    alter table ads_launcher.weekly_painpoints
      add constraint weekly_painpoints_data_mismatch_count_check
      check (data_mismatch_count is null or data_mismatch_count between 0 and 1000);
  end if;
end
$$;
