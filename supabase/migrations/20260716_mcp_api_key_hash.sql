-- MCP API keys: store hash + prefix instead of reversible plaintext.
-- Backward compatible: existing rows keep api_key; new rows set api_key_hash + api_key_prefix.
-- App lookup prefers hash, falls back to legacy plaintext column during transition.

set search_path = ads_launcher, public;

do $$
begin
  if to_regclass('ads_launcher.mcp_api_keys') is null then
    raise notice 'mcp_api_keys not present — skip';
    return;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'ads_launcher' and table_name = 'mcp_api_keys' and column_name = 'api_key_hash'
  ) then
    alter table ads_launcher.mcp_api_keys
      add column api_key_hash text,
      add column api_key_prefix text;
  end if;

  -- Unique hash when present
  create unique index if not exists mcp_api_keys_api_key_hash_uidx
    on ads_launcher.mcp_api_keys (api_key_hash)
    where api_key_hash is not null;

  -- Allow legacy api_key to become nullable once all keys migrated (do not force yet)
  -- New inserts will leave api_key null and set hash/prefix.
end $$;
