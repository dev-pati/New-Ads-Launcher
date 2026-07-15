-- 20260716_snapshot_csv_metrics.sql
-- Non-destructive: add columns needed to map Meta Ads Manager CSV export metrics
-- to the existing campaign/adset/ad insights snapshot tables.
-- Safe to re-run (add column if not exists via DO block).

-- ── campaign_insights_snapshots ────────────────────────────────────────────
do $$ begin
  alter table campaign_insights_snapshots add column if not exists purchase_roas double precision;
  alter table campaign_insights_snapshots add column if not exists unique_clicks integer default 0;
  alter table campaign_insights_snapshots add column if not exists unique_inline_link_clicks integer default 0;
  alter table campaign_insights_snapshots add column if not exists unique_link_clicks_ctr double precision;
  alter table campaign_insights_snapshots add column if not exists ctr_all double precision;
  alter table campaign_insights_snapshots add column if not exists landing_page_views integer default 0;
  alter table campaign_insights_snapshots add column if not exists landing_page_view_rate double precision;
  alter table campaign_insights_snapshots add column if not exists content_views integer default 0;
  alter table campaign_insights_snapshots add column if not exists add_to_carts integer default 0;
  alter table campaign_insights_snapshots add column if not exists initiate_checkouts integer default 0;
  alter table campaign_insights_snapshots add column if not exists avg_watch_time double precision;
  alter table campaign_insights_snapshots add column if not exists bid_amount integer;
  alter table campaign_insights_snapshots add column if not exists bid_strategy text;
  alter table campaign_insights_snapshots add column if not exists budget_amount double precision;
  alter table campaign_insights_snapshots add column if not exists budget_type text;
  alter table campaign_insights_snapshots add column if not exists attribution_setting text;
  alter table campaign_insights_snapshots add column if not exists starts_at timestamptz;
  alter table campaign_insights_snapshots add column if not exists ends_at timestamptz;
  alter table campaign_insights_snapshots add column if not exists custom_metrics jsonb default '{}'::jsonb;
exception when duplicate_column then null; end $$;

-- ── adset_insights_snapshots ───────────────────────────────────────────────
do $$ begin
  alter table adset_insights_snapshots add column if not exists purchase_roas double precision;
  alter table adset_insights_snapshots add column if not exists unique_clicks integer default 0;
  alter table adset_insights_snapshots add column if not exists unique_inline_link_clicks integer default 0;
  alter table adset_insights_snapshots add column if not exists unique_link_clicks_ctr double precision;
  alter table adset_insights_snapshots add column if not exists ctr_all double precision;
  alter table adset_insights_snapshots add column if not exists landing_page_views integer default 0;
  alter table adset_insights_snapshots add column if not exists landing_page_view_rate double precision;
  alter table adset_insights_snapshots add column if not exists content_views integer default 0;
  alter table adset_insights_snapshots add column if not exists add_to_carts integer default 0;
  alter table adset_insights_snapshots add column if not exists initiate_checkouts integer default 0;
  alter table adset_insights_snapshots add column if not exists avg_watch_time double precision;
  alter table adset_insights_snapshots add column if not exists bid_amount integer;
  alter table adset_insights_snapshots add column if not exists bid_strategy text;
  alter table adset_insights_snapshots add column if not exists budget_amount double precision;
  alter table adset_insights_snapshots add column if not exists budget_type text;
  alter table adset_insights_snapshots add column if not exists attribution_setting text;
  alter table adset_insights_snapshots add column if not exists starts_at timestamptz;
  alter table adset_insights_snapshots add column if not exists ends_at timestamptz;
  alter table adset_insights_snapshots add column if not exists custom_metrics jsonb default '{}'::jsonb;
exception when duplicate_column then null; end $$;

-- ── ad_insights_snapshots ──────────────────────────────────────────────────
do $$ begin
  alter table ad_insights_snapshots add column if not exists unique_clicks integer default 0;
  alter table ad_insights_snapshots add column if not exists unique_inline_link_clicks integer default 0;
  alter table ad_insights_snapshots add column if not exists unique_link_clicks_ctr double precision;
  alter table ad_insights_snapshots add column if not exists ctr_all double precision;
  alter table ad_insights_snapshots add column if not exists landing_page_views integer default 0;
  alter table ad_insights_snapshots add column if not exists landing_page_view_rate double precision;
  alter table ad_insights_snapshots add column if not exists content_views integer default 0;
  alter table ad_insights_snapshots add column if not exists bid_amount integer;
  alter table ad_insights_snapshots add column if not exists bid_strategy text;
  alter table ad_insights_snapshots add column if not exists budget_amount double precision;
  alter table ad_insights_snapshots add column if not exists budget_type text;
  alter table ad_insights_snapshots add column if not exists attribution_setting text;
  alter table ad_insights_snapshots add column if not exists custom_metrics jsonb default '{}'::jsonb;
exception when duplicate_column then null; end $$;
