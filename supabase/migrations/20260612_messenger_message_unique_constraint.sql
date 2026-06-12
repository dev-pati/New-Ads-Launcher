create schema if not exists ads_launcher;
set search_path = ads_launcher, public;

do $$
begin
  if to_regclass('ads_launcher.page_messages') is not null then
    create unique index if not exists idx_page_messages_org_fb_message_id_unique
      on ads_launcher.page_messages(org_id, fb_message_id);
  end if;
end $$;
