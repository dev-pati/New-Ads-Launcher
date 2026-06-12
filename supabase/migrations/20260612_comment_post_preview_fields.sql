create schema if not exists ads_launcher;
set search_path = ads_launcher, public;

alter table if exists comments
  add column if not exists fb_post_permalink text,
  add column if not exists fb_post_full_picture text,
  add column if not exists fb_post_reactions int default 0,
  add column if not exists fb_post_comments int default 0,
  add column if not exists fb_post_shares int default 0;
