# Database Tables — AdLauncher

> Nguồn: `supabase/adlauncher_full_bootstrap.sql` + 26 migration files  
> Tổng cộng: **41 bảng**

---

## Auth & User

| # | Tên bảng | File định nghĩa |
|---|----------|-----------------|
| 1 | `accounts` | `adlauncher_full_bootstrap.sql` |
| 2 | `profiles` | `schema.sql` |
| 3 | `user_settings` | `schema.sql` |

---

## Organization

| # | Tên bảng | File định nghĩa |
|---|----------|-----------------|
| 4 | `organizations` | `schema.sql` |
| 5 | `org_members` | `schema.sql` |
| 6 | `org_invitations` | `schema.sql` |
| 7 | `org_ai_keys` | `20260510_org_ai_keys.sql` |

---

## Meta / Facebook

| # | Tên bảng | File định nghĩa |
|---|----------|-----------------|
| 8 | `facebook_connections` | `schema.sql` |
| 9 | `business_managers` | `schema.sql` |
| 10 | `pages` | `schema.sql` |
| 11 | `ad_accounts` | `schema.sql` |
| 12 | `page_links` | `schema.sql` |
| 13 | `meta_api_cache` | `20260526_meta_api_cache.sql` |

---

## Google

| # | Tên bảng | File định nghĩa |
|---|----------|-----------------|
| 14 | `google_connections` | `20260520_google_connections.sql` |

---

## Creatives & Ads

| # | Tên bảng | File định nghĩa |
|---|----------|-----------------|
| 15 | `creatives` | `schema.sql` |
| 16 | `ads` | `schema.sql` |
| 17 | `ad_media` | `schema.sql` |
| 18 | `ad_set_presets` | `20260501_ad_set_presets.sql` |
| 19 | `ad_copy_templates` | `20260508_ad_copy_templates.sql` |

---

## Launch

| # | Tên bảng | File định nghĩa |
|---|----------|-----------------|
| 20 | `launch_batches` | `20260505_launch_batches.sql` |
| 21 | `launch_drafts` | `20260515_launch_drafts.sql` |
| 22 | `scheduled_activations` | `20260507_scheduled_activations.sql` |

---

## Asset Boards & Requests

| # | Tên bảng | File định nghĩa |
|---|----------|-----------------|
| 23 | `asset_boards` | `20260508_asset_boards_requests.sql` |
| 24 | `board_assets` | `20260508_asset_boards_requests.sql` |
| 25 | `creative_requests` | `20260508_asset_boards_requests.sql` |

---

## Comments

| # | Tên bảng | File định nghĩa |
|---|----------|-----------------|
| 26 | `comments` | `20260508_comments.sql` |
| 27 | `comment_automations` | `20260508_comments.sql` |
| 28 | `automation_runs` | `20260508_comments.sql` |

---

## Automations

| # | Tên bảng | File định nghĩa |
|---|----------|-----------------|
| 29 | `automations` | `20260510_automations.sql` |
| 30 | `automation_executions` | `20260510_automations.sql` |
| 31 | `automation_approvals` | `20260510_automations.sql` |
| 32 | `budget_schedules` | `20260510_automations.sql` |

---

## MCP / OAuth

| # | Tên bảng | File định nghĩa |
|---|----------|-----------------|
| 33 | `mcp_api_keys` | `20260510_mcp_api_keys.sql` |
| 34 | `mcp_oauth_codes` | `20260510_mcp_oauth.sql` |
| 35 | `mcp_oauth_tokens` | `20260510_mcp_oauth.sql` |
| 36 | `mcp_oauth_clients` | `20260510_mcp_oauth.sql` |

---

## Inspiration

| # | Tên bảng | File định nghĩa |
|---|----------|-----------------|
| 37 | `inspo_saved_ads` | `20260510_inspo_saved_ads.sql` |
| 38 | `inspo_boards` | `20260514_inspo_boards.sql` |
| 39 | `inspo_board_saves` | `20260514_inspo_boards.sql` |

---

## Notifications & Config

| # | Tên bảng | File định nghĩa |
|---|----------|-----------------|
| 40 | `notifications` | `20260511_notifications.sql` |
| 41 | `naming_schemas` | `20260514_naming_schema.sql` |
