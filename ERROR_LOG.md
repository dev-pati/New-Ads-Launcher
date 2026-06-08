# AdLauncher — Error Log

> Format mỗi entry: WHY → PROBLEM → FIX → PREVENTION
> Cập nhật mỗi khi fix bug mới.

---

## [2026-06-08] Vercel deploy fail vì `ffmpeg-static` download binary

**WHY:** `ffmpeg-static` chạy script postinstall để download ffmpeg binary trong lúc Vercel install dependencies. Download binary `b6.1.1` fail nên `npm install` dừng với exit code 1 trước khi Next build chạy.

**PROBLEM:** Deploy trên Vercel bị chặn hoàn toàn. Trong app, ffmpeg chỉ là fallback để extract thumbnail video ở `lib/ffmpeg-thumbnail.ts`, không phải dependency bắt buộc cho core launch/upload flow.

**FIX:**
1. Gỡ `ffmpeg-static`, `fluent-ffmpeg`, `@types/fluent-ffmpeg` khỏi dependencies.
2. Đổi `lib/ffmpeg-thumbnail.ts` sang dynamic import runtime bằng `Function("specifier", "return import(specifier)")` để TypeScript/build không yêu cầu package tồn tại.
3. Giữ behavior fallback: nếu runtime không có ffmpeg package/binary thì thumbnail extraction trả `null` thay vì crash.

**PREVENTION:**
- Không để package có postinstall download binary nằm trong dependency path của Vercel nếu feature chỉ là optional fallback.
- Với Vercel/serverless, ưu tiên dùng Meta thumbnail/source URL hoặc service riêng cho media processing nặng thay vì cài ffmpeg binary trong app build.
- Sau thay đổi dependency, luôn chạy `npm run typecheck` và `npm run build`.

---

## [2026-06-08] API route hardening: Supabase client + missing auth guards

**WHY:** Một số API route vẫn còn đi lệch rule server-side hiện tại: `/api/facebook/existing-ads` dùng `createClient()` thay vì `createAdminClient()`, còn `/api/google/read-sheet` và `/api/creatives/upload-proxy` không tự kiểm session trong route.

**PROBLEM:** `existing-ads` có thể bị RLS chặn hoặc trả dữ liệu không ổn định trên Supabase cloud. Hai route proxy/read nếu bị gọi trực tiếp không cần login sẽ mở thêm bề mặt rủi ro: app có thể bị dùng như proxy đọc Google Sheet bằng token client hoặc proxy upload bằng signed URL bị lộ.

**FIX:**
1. Đổi `/api/facebook/existing-ads` sang `createAdminClient()` để đồng bộ rule API routes dùng service role server-side.
2. Thêm `getAuthContext()` guard cho `/api/google/read-sheet`.
3. Thêm `getAuthContext()` guard cho `/api/creatives/upload-proxy`.
4. Đổi Next config `middlewareClientMaxBodySize` sang `proxyClientMaxBodySize` để bỏ warning deprecated.

**PREVENTION:**
- Quét định kỳ `app/api` để không còn import `@/lib/supabase/server` hoặc gọi `createClient()` trong API routes.
- Mọi route proxy hoặc route nhận token/signed URL từ client phải có auth guard, kể cả khi UI chỉ gọi từ trang đã login.
- Sau thay đổi nền, luôn chạy `npm run typecheck` và `npm run build`.

---

## [2026-06-06] Production 500 errors trên Vercel

**WHY:** Supabase cloud dùng RLS (Row Level Security). RLS kiểm tra `auth.uid()` từ JWT. Custom JWT của chúng ta thiếu field `role` và `aud` → Supabase không nhận ra là authenticated user → `auth.uid()` trả về null → RLS block toàn bộ query.

**PROBLEM:** Tất cả 41 API routes dùng `createClient()` — client này forward JWT của user lên Supabase và bị RLS chặn. Trên self-hosted MacMini thì không bị vì RLS config khác.

**FIX:**
1. Thêm `role: "authenticated"` và `aud: "authenticated"` vào JWT payload trong `lib/custom-auth.ts`
2. Thay toàn bộ 41 routes từ `createClient()` → `createAdminClient()` (bypass RLS hoàn toàn, dùng service_role key)

**PREVENTION:**
- API routes luôn dùng `createAdminClient()` — không dùng `createClient()` trong server-side routes
- Khi migrate DB (self-hosted → cloud), phải test auth flow ngay lập tức trên production

---

## [2026-06-06] Schedule trigger không fire đúng giờ

**WHY:** Logic `timeMatches` sai — điều kiện `nowMin < 60` luôn luôn true → cron check không bao giờ "miss" nhưng cũng không bao giờ "match" đúng giờ cụ thể.

**PROBLEM:** Cron chạy mỗi phút, nhưng không có window check → automation fire liên tục hoặc không fire.

**FIX:**
- `timeMatches = nowHour === targetHour && nowMin >= targetMin && nowMin < targetMin + 5`
- Thêm field `last_scheduled_run_at` riêng biệt với `last_run_at` → manual Run không block scheduled cron
- Cooldown 23h cho daily trigger

**PREVENTION:**
- Schedule trigger cần 2 cooldown fields riêng biệt: manual và scheduled
- Window 5 phút để tránh miss khi cron delayed

---

## [2026-06-06] Lark login lỗi "lark_failed" / FK constraint

**WHY:** `profiles` table có FK `REFERENCES auth.users(id)`. Custom auth accounts không tồn tại trong `auth.users` (đây là Supabase Auth table, khác với `ads_launcher.accounts`).

**PROBLEM:** Lark callback cố upsert vào `profiles` → FK fail → crash.

**FIX:** Xóa phần upsert `profiles` khỏi Lark callback route.

**PREVENTION:**
- Custom auth accounts sống ở `ads_launcher.accounts`, không liên quan đến `auth.users`
- Không dùng bất kỳ table nào có FK đến `auth.users` cho custom auth flow

---

## [2026-06-06] Email không gửi được trên Vercel (Gmail SMTP)

**WHY:** Vercel serverless chặn outbound SMTP (port 25/465/587) vì lý do bảo mật/spam prevention.

**PROBLEM:** Gmail SMTP hoàn toàn không hoạt động trên Vercel production dù credentials đúng.

**FIX:** Bỏ Gmail SMTP, chuyển sang Resend API (HTTP-based, không dùng SMTP).

**PREVENTION:**
- Vercel = không dùng SMTP. Luôn dùng HTTP email API (Resend, SendGrid, Postmark)
- Resend free tier chỉ gửi được đến email của chủ account → cần verify domain `patigroup.com` để gửi cho người khác

**TODO:** Verify `patigroup.com` trên Resend dashboard để gửi email cho tất cả user.

---

## [2026-06-06] MacMini production dùng sai DB (self-hosted thay vì cloud)

**WHY:** `NEXT_PUBLIC_SUPABASE_URL` là biến được "bake" vào bundle lúc build (`next build`). Khi MacMini build app, nó dùng env var lúc đó — là self-hosted URL cũ.

**PROBLEM:** Dù `.env.local` đã đổi sang cloud URL, app trên MacMini vẫn kết nối self-hosted DB vì bundle đã được bake.

**FIX:** Phải rebuild lại app trên MacMini với env var mới (`NEXT_PUBLIC_SUPABASE_URL=cloud_url npm run build`).

**PREVENTION:**
- `NEXT_PUBLIC_*` vars = build-time, không phải runtime → đổi env phải rebuild
- Server-side vars (không có `NEXT_PUBLIC_`) có thể đổi mà không cần rebuild

---

## [2026-06-06] `automations` table thiếu column `steps`

**WHY:** Migration chưa được chạy trên cloud DB sau khi migrate từ MacMini.

**PROBLEM:** API save automation trả về 500 vì column `steps` không tồn tại.

**FIX:**
```sql
ALTER TABLE ads_launcher.automations ADD COLUMN IF NOT EXISTS steps JSONB DEFAULT NULL;
ALTER TABLE ads_launcher.automations ADD COLUMN IF NOT EXISTS notif_config JSONB DEFAULT NULL;
ALTER TABLE ads_launcher.automations ADD COLUMN IF NOT EXISTS last_scheduled_run_at TIMESTAMPTZ;
```

**PREVENTION:**
- Sau mỗi lần migrate DB, chạy toàn bộ pending migrations trên DB mới ngay lập tức
- Giữ `supabase/migrations/` luôn đồng bộ với schema thực tế

---

## [2026-06-06] Ethan không vào được org

**WHY:** Ethan đăng ký tài khoản nhưng chưa được thêm vào `org_members`. Hệ thống không tự động add user vào org khi đăng ký — chỉ có người tạo org mới được tự động add.

**PROBLEM:** Ethan thấy "No organizations yet" dù đã login thành công.

**FIX:**
```sql
INSERT INTO ads_launcher.org_members (org_id, user_id, role)
SELECT o.id, a.id, 'admin'
FROM ads_launcher.organizations o
CROSS JOIN ads_launcher.accounts a
WHERE a.email = 'ethan@patigroup.com'
ON CONFLICT (org_id, user_id) DO UPDATE SET role = 'admin';
```

**PREVENTION:**
- Cần implement invite flow hoặc auto-add user vào org khi được invite
- Admin cần biết: đăng ký tài khoản ≠ có quyền vào org → phải add thủ công hoặc qua invite link

---
