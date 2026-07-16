# Deploy-Safe Order — DB Standardization

> Branch: `migration/db-standardization` (commit `dd171c4`)
> Nguyên tắc: **decrypt-read deploy TRƯỚC → migration schema → backfill encrypt SAU**.
> Sai thứ tự = mất token đang chạy (Meta launch / Google Drive / AI fail).

Ký hiệu: ⛔ blocking · ⚠️ verify · ↩️ rollback point

---

## Phase 0 — Pre-flight (không đụng prod)

- [ ] ⛔ Backup DB đầy đủ (snapshot Supabase / `pg_dump`). ↩️ đây là rollback gốc.
- [ ] ⛔ Sinh key riêng: `openssl rand -hex 32` → set `DB_ENCRYPTION_KEY`.
      **KHÔNG** dùng chung `CUSTOM_AUTH_SECRET` / `JWT_SECRET`.
- [ ] ⛔ Lưu key vào secret manager (không commit, không log). Ghi lại ai giữ.
- [ ] ⚠️ Xác nhận helper đã tồn tại trên live (migration hard-fail nếu thiếu):
      ```sql
      select proname from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='ads_launcher'
        and proname in ('current_account_id','is_org_member');
      ```
      Thiếu → apply schema/older migration trước, dừng ở đây.
- [ ] ⚠️ Typecheck sạch: `npx tsc --noEmit` (branch đã 0 error).
- [ ] ⚠️ Đọc trước: backfill dùng service_role, chạy 1 lần, có `DRY_RUN`.

---

## Phase 1 — Deploy CODE (decrypt-capable) — chưa bật gì phá dữ liệu

Mục tiêu: app biết **đọc** cả plaintext lẫn `enc:v1:` trước khi có ciphertext nào.

- [ ] ⛔ Set `DB_ENCRYPTION_KEY` trên runtime env TRƯỚC khi deploy code.
- [ ] ⛔ Deploy branch code (crypto reads/writes + ads org-scope).
      - Ghi chú: sau bước này, **các write mới đã bắt đầu encrypt** (callback FB, google connect, ai-keys POST, select-page, page token sync).
      - An toàn vì `decryptSecret` fallback plaintext cho row cũ.
- [ ] ⚠️ Smoke test **đọc** (row cũ vẫn plaintext):
      - [ ] Meta: mở 1 ad account, load ads (token cũ decrypt = passthrough).
      - [ ] Google Drive/Sheets: 1 call (refresh token cũ vẫn đọc).
      - [ ] AI feature (naming/generate) chạy.
      - [ ] MCP: gọi bằng `al_...` key hiện có (không encrypt — phải nguyên).
- [ ] ⚠️ Smoke test **ghi mới** (tạo ciphertext):
      - [ ] Reconnect 1 Facebook test connection → row có `access_token` bắt đầu `enc:v1:`.
      - [ ] Nhập lại AI key test → cột `enc:v1:`.
      - [ ] Đọc lại 2 cái trên qua app → giá trị đúng (roundtrip live).
- [ ] ↩️ Rollback nếu fail: revert code deploy. Chưa có backfill nên data cũ nguyên vẹn. Ciphertext mới vẫn decrypt được **miễn key không đổi** → nếu rollback code, giữ nguyên `DB_ENCRYPTION_KEY` để không kẹt vài row mới.

**Gate:** không sang Phase 2 tới khi roundtrip live OK.

---

## Phase 2 — Apply SCHEMA migration

File: `supabase/migrations/20260715_schema_standardization.sql`

- [ ] ⛔ Chạy trong transaction / migration tool (Supabase CLI hoặc psql `\i`).
- [ ] ⚠️ Migration idempotent nhưng **hard-fail** nếu thiếu helper — mong đợi.
- [ ] ⚠️ Verify sau apply:
      ```sql
      -- enum 6 role
      select enumlabel from pg_type t join pg_enum e on e.enumtypid=t.oid
      join pg_namespace n on n.oid=t.typnamespace
      where t.typname='org_role' and n.nspname='ads_launcher' order by enumsortorder;

      -- role helpers
      select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='ads_launcher'
        and proname in ('can_edit_ads','can_delete_ads','can_upload_media','can_write_comments');

      -- page-manager FK org_id
      select conname from pg_constraint
      where conname like 'page_%_org_id_fkey';

      -- RLS enabled nhưng 0 policy (phải rỗng)
      select c.relname from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
      left join pg_policy p on p.polrelid=c.oid
      where n.nspname='ads_launcher' and c.relkind='r' and c.relrowsecurity
      group by c.relname having count(p.*)=0;
      ```
- [ ] ⚠️ Regression: app vẫn chạy (service_role bypass RLS nên policy đổi **không** ảnh hưởng đường admin hiện tại — đúng kỳ vọng).
- [ ] ↩️ Rollback: RLS/FK là additive; nếu FK chặn insert bất ngờ → `drop constraint page_*_org_id_fkey`. Không revert cả migration trừ khi cần.

**Lưu ý:** ADD VALUE vào enum không rollback trong cùng tx ở Postgres cũ — chạy phần enum riêng nếu tool phàn nàn.

---

## Phase 3 — BACKFILL encrypt (điểm không quay đầu mềm)

Script: `scripts/migrate-encrypt-secrets.mjs`

- [ ] ⛔ Xác nhận Phase 1 đã prod ≥ vài giờ, không lỗi decrypt.
- [ ] ⛔ Backup lại DB ngay trước backfill. ↩️ rollback = restore backup.
- [ ] ⚠️ DRY RUN trước:
      ```bash
      DRY_RUN=1 node --env-file=.env scripts/migrate-encrypt-secrets.mjs
      ```
      Đọc report `scanned / changed / skipped`. `changed` = số row plaintext còn lại.
- [ ] ⛔ Chạy thật (cùng `DB_ENCRYPTION_KEY` với runtime — **bắt buộc trùng**):
      ```bash
      node --env-file=.env scripts/migrate-encrypt-secrets.mjs
      ```
      - Idempotent: chạy lại chỉ encrypt row mới.
      - Fail > 0 → script exit 1, xem log PK lỗi.
- [ ] ⚠️ Verify hết plaintext trên cột nhạy cảm:
      ```sql
      select 'facebook_connections' t, count(*) pl_left
        from ads_launcher.facebook_connections
        where access_token is not null and access_token not like 'enc:v1:%'
      union all select 'google_connections',
        count(*) from ads_launcher.google_connections
        where (access_token not like 'enc:v1:%' or refresh_token not like 'enc:v1:%')
      union all select 'pages',
        count(*) from ads_launcher.pages
        where page_access_token is not null and page_access_token not like 'enc:v1:%'
      union all select 'org_ai_keys',
        count(*) from ads_launcher.org_ai_keys
        where (gemini_api_key is not null and gemini_api_key not like 'enc:v1:%')
           or (openai_api_key is not null and openai_api_key not like 'enc:v1:%');
      ```
      Tất cả `pl_left = 0` (trừ null).
- [ ] ⚠️ Post-backfill smoke (token giờ toàn ciphertext):
      - [ ] Meta launch thật 1 ad (đường quan trọng nhất).
      - [ ] Google Drive import.
      - [ ] AI naming/generate.
      - [ ] Cron `upload-to-facebook` chạy 1 nhịp OK.
- [ ] ↩️ Rollback: restore backup pre-backfill. **Không** thử "decrypt ngược" thủ công.

**Cảnh báo key:** sau backfill, đổi/mất `DB_ENCRYPTION_KEY` = mất toàn bộ token. Khóa quyền đổi env này.

---

## Phase 4 — Tenant isolation rollout (tuỳ chọn, tăng dần)

Không blocking encrypt, nhưng là phần "multi-tenant thật".

- [ ] Chạy guardrail, triage:
      ```bash
      node scripts/check-admin-org-scope.mjs
      ```
- [ ] Whitelist hợp lệ: `auth/`, `cron/`, `health/`, `mcp/oauth/`, webhook, video-upload.
- [ ] Với route user-facing còn admin-bypass: thêm `.eq("org_id", ctx.orgId)` hoặc chuyển `createTenantClient`.
- [ ] Ads POST: verify `page_id` & `ad_account_id` thuộc `ctx.orgId` trước insert.
- [ ] Sau khi RLS tin cậy: cho phép fail CI khi route mới thiếu org scope.

---

## Phase 5 — Hardening theo sau (không trong branch này)

- [ ] `GET /api/settings/ai-keys`: mask secret (`••••last4`), đừng trả full.
- [ ] Deprecate `adlauncher_client_token` cho authZ; tenant client chỉ httpOnly.
- [ ] Approve/reject automation: signed token + expiry + single-use.
- [ ] MCP: `api_key_hash` + show-once thay plaintext lookup.
- [ ] Crypto: thêm AAD `org_id`, key version (`enc:v2`), rotation plan.
- [ ] SECURITY DEFINER helpers: `SET search_path = ads_launcher, public`.

---

## Rollback decision (nhanh)

| Sự cố tại | Hành động |
|---|---|
| Phase 1 (code) | Revert deploy; giữ `DB_ENCRYPTION_KEY`; data cũ nguyên |
| Phase 2 (schema) | Drop FK/policy vừa thêm; enum để nguyên |
| Phase 3 (backfill) | Restore backup pre-backfill |
| Mất/nhầm key sau backfill | Restore backup; re-issue tokens (user reconnect) |

---

## One-line order

```text
backup → set DB_ENCRYPTION_KEY → deploy code → smoke read+write
→ apply 20260715 → verify → backup → DRY_RUN → backfill → verify 0 plaintext
→ smoke launch/drive/ai/cron → (later) tenant isolation + hardening
```
