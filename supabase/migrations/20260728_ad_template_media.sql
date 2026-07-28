-- P0 template loop: a template saved from a winning ad carries its media reference
-- and a snapshot of the metrics it earned, so the Templates page can show the same
-- card the prototype does (thumbnail + ROAS badge) and Launch can preselect creatives.
--
--   media       {creative_ids[], thumb_url, media_type, image_hash, video_id, needs_media}
--   metrics     {spend, roas, results, date_preset, captured_at}
--   source_ad_id  Meta ad id the template was saved from (null for hand-written templates)
set search_path = ads_launcher, public;

alter table ad_copy_templates
  add column if not exists media        jsonb,
  add column if not exists metrics      jsonb,
  add column if not exists source_ad_id text;

-- Templates saved from the same ad twice should be findable; not unique on purpose
-- (a user may keep several variants cut from one winner).
create index if not exists ad_copy_templates_source_ad_idx
  on ad_copy_templates(org_id, source_ad_id)
  where source_ad_id is not null;
