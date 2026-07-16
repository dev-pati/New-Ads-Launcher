# DB Architecture: Old vs New

> Chuẩn hóa multi-tenant DB cho AdLauncher (company-wide).  
> Branch: `migration/db-standardization`  
> Commit: `dd171c4`  
> Scope: auth + schema + secrets + tenant isolation. Feature surface (launch, inspo, page manager…) giữ nguyên; thay **cách DB bảo vệ data**.

---

## 1. Big picture

```text
OLD (thực tế runtime)
┌──────────────┐   JWT cookie    ┌─────────────────┐  service_role  ┌──────────────┐
│ Browser / API│ ──────────────► │ Next.js routes  │ ─────────────► │ Postgres     │
└──────────────┘                 │ createAdminClient│  (bypass RLS) │ ads_launcher │
                                 │ filter thủ công  │               │ + RLS "có    │
                                 │ (user_id / đôi  │               │   nhưng chết"│
                                 │  khi org_id)    │               └──────────────┘
                                 └─────────────────┘
                                 Secrets: plaintext
                                 Schema: 2 lineage lẫn

NEW (hướng chuẩn hóa)
┌──────────────┐   JWT cookie    ┌─────────────────┐
│ Browser / API│ ──────────────► │ Next.js routes  │
└──────────────┘                 │ getAuthContext  │
                                 │  ├─ tenant path │── JWT + anon ──► RLS enforce
                                 │  └─ admin path  │── service_role ─► org_id bắt buộc
                                 └─────────────────┘
                                 Secrets: AES-GCM at rest
                                 Schema: 1 canonical + migrations
```

---

## 2. Auth model

| | **Cũ (lẫn)** | **Mới (chốt)** |
|---|---|---|
| Identity | `accounts` (custom JWT) **và** dấu vết `auth.users` / `profiles` | `accounts` + `current_account_id()` từ JWT `sub` |
| Session | Cookie `adlauncher_session` 30d, không revoke table | Giữ model này (chưa làm session revoke) |
| Org context | `active_org_id` cookie + `org_members` check trong `getAuthContext` | Giữ; **route bắt buộc** dùng `ctx.orgId` |
| RLS helpers | `auth.uid()` trong `schema.sql` / một số migration | `current_account_id()` + `is_org_member` / `can_edit_*` |

### Vì sao không chuyển sang Supabase Auth thuần?

App đã custom JWT + bcrypt `accounts`. Đổi auth = rewrite login, cookie, membership, deploy risk. Chuẩn hóa **trên custom-auth lineage** rẻ hơn và khớp code thật.

**Key files**

- [lib/custom-auth.ts](../lib/custom-auth.ts) — JWT cookie, bcrypt
- [lib/auth.ts](../lib/auth.ts) — `getAuthContext`, Facebook connection resolve + decrypt
- [lib/supabase/server.ts](../lib/supabase/server.ts) — JWT → Authorization header
- [lib/supabase/tenant.ts](../lib/supabase/tenant.ts) — user-scoped client (RLS path)
- [lib/supabase/admin.ts](../lib/supabase/admin.ts) — service_role (bypass RLS)

---

## 3. Schema governance

```text
OLD
  schema.sql              ← Supabase Auth (auth.users, auth.uid)
  schema.ads_launcher.sql ← custom auth (accounts) — stale / 2-role
  cloud_setup.sql
  adlauncher_full_bootstrap.sql
  migrations/*            ← pha 2 lineage (auth.users vs accounts)
       ↓
  "N nguồn of truth" → drift, apply nhầm, 6-role lệch dump

NEW
  schema.ads_launcher.sql  = CANONICAL bootstrap (custom auth)
  migrations/*             = live deltas only (date order)
  schema.sql               = legacy, không apply prod
```

### Migrate / replace map

| Artifact | Hành động |
|---|---|
| [schema.ads_launcher.sql](../supabase/schema.ads_launcher.sql) | **Canonical** — mark header, 6-role + role policies |
| [20260715_schema_standardization.sql](../supabase/migrations/20260715_schema_standardization.sql) | **Live migration** — enum roles, helpers, FK page-manager, hard RLS |
| `schema.sql` / multi-bootstrap | **Không xóa ngay** — de-prioritize; đừng apply prod |
| Soft-fail `IF EXISTS is_org_member` | **Replace** bằng hard fail / always create policy |

### Gap fill

- Một target (`ads_launcher` + `accounts`)
- RBAC 6-role khớp code
- FK org cho page-manager tables
- Policy không “im lặng deny-all”

---

## 4. Secrets at rest

```text
OLD write path
  OAuth callback / settings / google connect
       │
       ▼
  DB column TEXT  ← raw token / api key
       │
       ▼
  Any SELECT / backup / SQL console = full secret

NEW write path
  same entry points
       │
       ▼ encryptSecret()  (AES-256-GCM, enc:v1:iv:tag:cipher)
  DB column TEXT
       │
  read: decryptSecret()  (plaintext legacy vẫn đọc được)
```

| Column | Old | New |
|---|---|---|
| `facebook_connections.access_token` | plain | encrypt write + decrypt in `getFacebookConnection` / slot |
| `pages.page_access_token` | plain | encrypt on upsert + decrypt on resolve |
| `google_connections.*` | plain | encrypt + decrypt/refresh |
| `org_ai_keys.*` | plain | encrypt + decrypt |
| `meta_* .access_token_encrypted` | plain (tên lừa) | encrypt thật khi write |
| `mcp_api_keys.api_key` | plain | **giữ plain** (lookup `.eq("api_key", bearer)` — GCM random IV không equality được) |

### Vì sao app-layer AES-GCM, không pgsodium?

Custom JWT + self-host schema, service_role bypass RLS, deploy đã có `CUSTOM_AUTH_SECRET`. App-layer:

- zero extension dependency
- backward-compatible plaintext
- migrate one-shot script

pgsodium/Vault = ops + key manager riêng.

**Key files**

- [lib/crypto.ts](../lib/crypto.ts)
- [scripts/migrate-encrypt-secrets.mjs](../scripts/migrate-encrypt-secrets.mjs)
- Env: `DB_ENCRYPTION_KEY` (64 hex) — fallback `CUSTOM_AUTH_SECRET` (dev only)

### Gap fill

DB dump / compromised service-role SELECT không còn lộ Meta/Google/AI token raw (trừ MCP key — deferred hash design).

---

## 5. Tenant isolation (lỗ hổng lớn nhất)

```text
OLD (phổ biến)
  route → createAdminClient()  // bypass RLS
       → .eq("user_id", me)    // user-scoped, không org-scoped
       → teammate cùng org không thấy / user multi-org lẫn data

NEW (mục tiêu)
  User request path
    getAuthContext() → orgId + role
    createTenantClient()  // JWT → RLS is_org_member / can_edit_*
    hoặc createAdminClient + .eq("org_id", ctx.orgId) bắt buộc

  System path (cron / webhook / email-token)
    createAdminClient
    + secret (CRON_SECRET / approval token)
    + org_id từ row, không từ user cookie
```

| Pattern | Old | New (đã làm / chưa) |
|---|---|---|
| `createAdminClient` default | hầu hết API | vẫn default; helper tenant **có**, adopt **chưa rộng** |
| Ads list/detail/media | `user_id` only | **cần re-apply org_id** nếu working tree revert |
| Creatives / many routes | `org_id` OK | giữ |
| Guardrail script | không | [scripts/check-admin-org-scope.mjs](../scripts/check-admin-org-scope.mjs) |

### Vì sao không flip 121 route sang tenant client trong 1 PR?

Risk blast: RLS + JWT claim phải đúng 100% (`role`/`aud`/`sub`), soft-fail policy cũ, cron/webhook không có session. An toàn theo thứ tự:

1. Fix leak rõ (`org_id` thay `user_id`)
2. Hard RLS + FK
3. Migrate secrets
4. Dần replace admin bằng tenant client

### Gap fill

- Multi-tenant workspace thật (teammate cùng org)
- Chặn cross-org khi multi-membership
- RLS không còn “trang trí”

---

## 6. Data flow — Facebook token

```text
OLD
  Facebook OAuth
    → save access_token plaintext
    → API read token → Meta Graph
    → anyone with DB/admin key reads all orgs' tokens

NEW
  Facebook OAuth
    → encryptSecret → DB
    → getFacebookConnection decrypt → Meta Graph
    → migrate-encrypt-secrets.mjs backfill rows cũ
    → plaintext rows vẫn work đến khi migrate xong
```

Write paths (encrypt):

- [app/api/auth/facebook/callback/route.ts](../app/api/auth/facebook/callback/route.ts)
- [app/api/facebook/connections/route.ts](../app/api/facebook/connections/route.ts) (manual via token)
- [lib/workspace-pages.ts](../lib/workspace-pages.ts)
- [lib/facebook-page-token.ts](../lib/facebook-page-token.ts)

Read paths (decrypt):

- [lib/auth.ts](../lib/auth.ts) — `getFacebookConnection`, slot connection
- [lib/facebook-page-token.ts](../lib/facebook-page-token.ts)
- [app/api/facebook/connections/[id]/check/route.ts](../app/api/facebook/connections/[id]/check/route.ts)

---

## 7. Migrate / replace map (thực thi)

| Layer | Replace | Keep | One-shot migrate |
|---|---|---|---|
| Schema source | multi-file → `schema.ads_launcher.sql` + migrations | table names, domain model | apply `20260715_…` on live |
| Auth | `auth.uid` lineage in new work | custom JWT, `accounts`, cookies | không rewrite login |
| Secrets | plaintext writes | column names (tránh rename big-bang) | `migrate-encrypt-secrets.mjs` |
| API isolation | `user_id`-only org data | service_role for cron/system | route-by-route org filter → later tenant client |
| MCP keys | (future) `api_key_hash` + show-once | plaintext lookup hôm nay | sau |

---

## 8. Gap cũ → fill mới (checklist)

| Gap cũ | New fills? | Status |
|---|---|---|
| 2 schema lineage / drift | 1 canonical + migration-only deltas | **code done**, live apply **chưa** |
| Soft-fail RLS (0 policy im lặng) | hard require helpers + explicit policies | **migration ready** |
| Missing org FK page-manager | FK `org_id → organizations` | **migration ready** |
| 6-role helpers lệch dump | `can_edit_ads`… + policies | **dump + migration** |
| Secrets plaintext | AES-GCM + decrypt reads | **code done**, backfill **chưa chạy** |
| Service-role + thiếu `org_id` | pattern + ads fix + guardrail | **partial** (ads có thể đã revert) |
| RLS dead vì admin-only | `createTenantClient` | **helper only**, chưa adopt |
| MCP key encrypt | không encrypt (đúng) | hash design **chưa** |
| Session revoke / audit | — | **out of scope** |

---

## 9. Vì sao kiến trúc này (4 lý do)

1. **Khớp code thật** — custom JWT + `accounts`, không giả vờ Supabase Auth.
2. **Defense in depth** — encrypt at rest + app org filter + RLS khi JWT path.
3. **Incremental** — plaintext decrypt fallback, soft→hard RLS migration, không big-bang 121 route.
4. **Company-wide multi-tenant** — org là boundary; user chỉ là actor trong org.

---

## 10. Còn phải làm để “new” thật sự live

1. Apply `supabase/migrations/20260715_schema_standardization.sql` lên live.
2. Set `DB_ENCRYPTION_KEY` (64 hex) — `openssl rand -hex 32`.
3. Dry-run rồi chạy backfill:
   ```bash
   DRY_RUN=1 node --env-file=.env scripts/migrate-encrypt-secrets.mjs
   node --env-file=.env scripts/migrate-encrypt-secrets.mjs
   ```
4. Re-apply org scope cho ads routes nếu working tree đã revert về `user_id`.
5. Push branch `migration/db-standardization`.
6. Dần: route user-facing → `createTenantClient`; admin chỉ cron/webhook.
7. (Later) MCP keys: `api_key_hash` + show-once plaintext.
8. (Later) Mark/remove legacy `schema.sql` bootstrap paths.

### Live verify SQL (sau apply migration)

```sql
-- tables with RLS enabled but 0 policies
select n.nspname, c.relname
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
left join pg_policy p on p.polrelid = c.oid
where n.nspname = 'ads_launcher'
  and c.relkind = 'r'
  and c.relrowsecurity
group by n.nspname, c.relname
having count(p.*) = 0;

-- org_role enum
select enumlabel
from pg_type t
join pg_enum e on e.enumtypid = t.oid
join pg_namespace n on n.oid = t.typnamespace
where t.typname = 'org_role' and n.nspname = 'ads_launcher'
order by enumsortorder;

-- role helpers
select proname
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'ads_launcher'
  and proname in ('can_edit_ads','can_delete_ads','can_upload_media','can_write_comments');
```

### Guardrail

```bash
node scripts/check-admin-org-scope.mjs
```

---

## Related files

| Path | Role |
|---|---|
| [supabase/schema.ads_launcher.sql](../supabase/schema.ads_launcher.sql) | Canonical schema dump |
| [supabase/migrations/20260715_schema_standardization.sql](../supabase/migrations/20260715_schema_standardization.sql) | Live standardization migration |
| [lib/crypto.ts](../lib/crypto.ts) | AES-256-GCM encrypt/decrypt |
| [lib/supabase/tenant.ts](../lib/supabase/tenant.ts) | JWT RLS client |
| [scripts/migrate-encrypt-secrets.mjs](../scripts/migrate-encrypt-secrets.mjs) | One-shot secret backfill |
| [scripts/check-admin-org-scope.mjs](../scripts/check-admin-org-scope.mjs) | Admin route org-scope scan |
