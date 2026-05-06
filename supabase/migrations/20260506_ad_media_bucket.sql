-- Storage bucket for ad creative thumbnails (canvas-extracted video frames + cached images)
-- Public read so Meta + browsers can fetch without auth
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'ad-media',
  'ad-media',
  true,
  524288000, -- 500 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime']
)
on conflict (id) do update set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read access
drop policy if exists "ad-media public read" on storage.objects;
create policy "ad-media public read"
  on storage.objects for select
  to public
  using (bucket_id = 'ad-media');

-- Authenticated upload
drop policy if exists "ad-media authenticated upload" on storage.objects;
create policy "ad-media authenticated upload"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'ad-media');

-- Authenticated update (for upsert behavior in save-thumbnail route)
drop policy if exists "ad-media authenticated update" on storage.objects;
create policy "ad-media authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'ad-media')
  with check (bucket_id = 'ad-media');

-- Authenticated delete (for cleanup if needed)
drop policy if exists "ad-media authenticated delete" on storage.objects;
create policy "ad-media authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'ad-media');
