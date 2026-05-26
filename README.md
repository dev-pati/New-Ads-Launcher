# AdLauncher - Hướng Dẫn Cài Đặt, Chạy Và Bàn Giao

Tài liệu này dành cho người mới nhận dự án. Chỉ cần đọc từ trên xuống và làm theo từng bước là có thể hiểu app dùng để làm gì, cần cài gì, chạy local ra sao, build production thế nào và khởi động lại app khi máy/server bị tắt.

## 1. App Này Là Gì?

AdLauncher là web app nội bộ dùng để quản lý creative assets, kết nối Meta/Facebook và launch quảng cáo lên Meta Ads.

Người dùng đăng nhập vào app, chọn Organization/workspace, kết nối tài khoản Meta/Facebook, chọn ad account/page/Instagram profile, upload media, cấu hình nội dung quảng cáo và launch ads.

Các nhóm chức năng chính:

- Quản lý nhiều Organization/workspace.
- Đăng nhập bằng Lark OAuth/SSO hoặc tài khoản nội bộ.
- Mời thành viên, quản lý team và quyền theo Organization.
- Kết nối Meta/Facebook theo từng Organization.
- Lấy ad accounts, Facebook Pages, Instagram profiles, pixels, catalogs.
- Upload và quản lý creative assets: ảnh, video, thumbnail, board, request.
- Tạo campaign/ad set/ad và launch ads lên Meta.
- Launch ads theo Gallery mode hoặc Table mode.
- Lưu launch drafts, scheduled ads và launch history.
- Xem Ads Manager: campaigns, ad sets, ads, status, budget, metrics.
- Xem Insights: spend, impressions, clicks, CTR, CPM, ROAS, top creatives, breakdowns.
- Automations, comments, notifications, templates, naming schema.
- Tích hợp Google Drive/Sheets, Resend email, OpenAI/Gemini nếu có cấu hình key.
- Có MCP/API key để công cụ bên ngoài truy cập một số chức năng quảng cáo.

## 2. Các Màn Hình Chính

Sau khi đăng nhập, app có các khu vực chính:

| Màn hình | Dùng để làm gì |
|---|---|
| Projects | Chọn hoặc tạo Organization/workspace. |
| Launch | Chọn creative, ad account, page, Instagram, ad set, copy, CTA, URL và launch ads. |
| Assets | Upload và quản lý ảnh/video, boards, creative requests, my uploads. |
| Ads Manager | Xem campaigns, ad sets, ads, chỉnh status/budget/name, duplicate/delete. |
| Insights | Xem báo cáo hiệu quả quảng cáo, top creatives, report, statistics, breakdowns. |
| Connect | Kết nối Meta, Google, API/MCP keys. |
| Automate | Tạo workflow/rules tự động hóa. |
| Inspo | Brand spy, ad scan, saved ads, AI content. |
| Templates | Quản lý ad copy templates và naming helpers. |
| Settings | Quản lý organization, members, AI keys, user settings. |

## 3. Công Nghệ Và Cấu Trúc Dự Án

Đây là app Next.js full-stack. Frontend và backend nằm chung trong một repo.

```text
app/
  (dashboard)/        Các màn hình chính sau đăng nhập
  api/                Backend API routes
  auth/               Login/register/callback pages
  invite/             Trang nhận lời mời vào organization
  projects/           Trang chọn organization/project

components/           UI components dùng lại nhiều nơi
hooks/                React hooks
lib/                  Logic dùng chung: auth, Supabase, Meta API, org context
supabase/             Database schema và migrations
scripts/              Script backup/restore/maintenance
public/               Static assets
```

Stack chính:

- Next.js 16 App Router
- React 19
- TypeScript
- Supabase/Postgres
- Meta Graph API v25
- Tailwind CSS / shadcn-style components
- Docker / Docker Compose cho production

## 4. Yêu Cầu Môi Trường

Máy chạy app cần cài trước:

| Công cụ | Phiên bản khuyến nghị | Dùng để làm gì |
|---|---:|---|
| Node.js | 20 trở lên | Chạy Next.js app |
| npm | Đi kèm Node.js | Cài dependencies |
| Git | Bản mới | Clone/pull source code |
| Docker | Bản mới | Chạy production bằng container |
| Docker Compose | Compose plugin | Chạy `docker compose up -d` |
| PostgreSQL client | Có `psql`, `pg_dump`, `pg_restore` | Chạy migration/backup/restore DB nếu cần |

Kiểm tra phiên bản:

```bash
node -v
npm -v
git --version
docker --version
docker compose version
```

Node.js nên là `v20.x.x` hoặc cao hơn.

Trên Windows PowerShell, nếu chạy `npm run ...` bị lỗi execution policy, dùng `npm.cmd` thay cho `npm`:

```powershell
npm.cmd run dev
npm.cmd run build
npm.cmd run typecheck
```

## 5. File Môi Trường

App cần file env để biết cách kết nối Supabase, Lark, Meta, Google, Resend, AI providers và cron jobs.

File mẫu trong repo:

```text
.env.example
```

File chạy local nên là:

```text
.env.local
```

File chạy Docker production thường là:

```text
.env
```

Các biến quan trọng:

| Biến | Ý nghĩa |
|---|---|
| `NEXT_PUBLIC_APP_URL` | Domain app, dùng cho OAuth callback và invite links. |
| `CUSTOM_AUTH_SECRET` | Secret ký JWT custom auth. Production phải dùng chuỗi dài, khó đoán. |
| `NEXT_PUBLIC_SUPABASE_URL` | URL Supabase API gateway. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key server-side. Không expose ra browser. |
| `NEXT_PUBLIC_SUPABASE_DB_SCHEMA` | Schema DB, app hiện dùng `ads_launcher`. |
| `LARK_APP_ID`, `LARK_APP_SECRET` | Lark OAuth/SSO. |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | Meta OAuth server-side. |
| `NEXT_PUBLIC_FACEBOOK_APP_ID` | Meta app id dùng ở client. |
| `RESEND_API_KEY` | Gửi email invitation/transactional. |
| `OPENAI_API_KEY`, `GEMINI_API_KEY` | AI features. Có thể fallback từ env nếu org chưa có key riêng. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Drive/Sheets. |
| `CRON_SECRET` | Bảo vệ cron endpoints. |

Không commit secret thật lên Git.

## 6. Cài Đặt Và Chạy Local Từ Đầu

### Bước 1: Clone source code

```bash
git clone <company-repo-url>
cd AdLauncher-master
```

Nếu source code đã có sẵn trên máy Windows:

```powershell
cd C:\PATI\AdLauncher-master
```

### Bước 2: Cài dependencies

```bash
npm ci
```

Trên Windows nếu `npm` bị chặn:

```powershell
npm.cmd ci
```

### Bước 3: Tạo file `.env.local`

Nếu đã có file env thật từ đội bàn giao:

```powershell
Copy-Item .env.example .env.local
```

Sau đó mở `.env.local` và điền giá trị thật cho Supabase, Lark, Meta, Google, Resend, AI keys.

Nếu đội bàn giao có file private riêng, copy file đó sang `.env.local`, ví dụ:

```powershell
Copy-Item handover-private\.env.local.full .env.local
```

Trên macOS/Linux:

```bash
cp .env.example .env.local
```

hoặc:

```bash
cp handover-private/.env.local.full .env.local
```

### Bước 4: Chạy typecheck

```bash
npm run typecheck
```

Trên Windows nếu cần:

```powershell
npm.cmd run typecheck
```

### Bước 5: Chạy app local

```bash
npm run dev
```

Trên Windows nếu cần:

```powershell
npm.cmd run dev
```

Mở trình duyệt:

```text
http://localhost:3000
```

Lưu ý: Meta/Facebook OAuth thường cần HTTPS domain đúng trong Meta Developer Console. Localhost chủ yếu dùng để kiểm tra UI, API nội bộ, assets, settings. Khi test kết nối Facebook thật, nên dùng domain production/staging HTTPS.

## 7. Database Và Migration

Database chính là Supabase/Postgres, schema app dùng là:

```text
ads_launcher
```

Schema snapshot:

```text
supabase/adlauncher_full_bootstrap.sql
supabase/schema.sql
supabase/schema.ads_launcher.sql
```

Migrations:

```text
supabase/migrations/
```

Migration mới quan trọng cho persistent Meta API cache:

```text
supabase/migrations/20260526_meta_api_cache.sql
```

Chạy migration bằng `psql`:

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260526_meta_api_cache.sql
```

Trên PowerShell:

```powershell
psql $env:DATABASE_URL -f supabase\migrations\20260526_meta_api_cache.sql
```

Nếu chưa apply migration cache, app vẫn có memory fallback, nhưng cache sẽ mất khi server restart.

### Dựng lại database từ đầu bằng một file SQL

Nếu cần dựng database trắng từ đầu, chạy file bootstrap duy nhất:

```bash
psql "$DATABASE_URL" -f supabase/adlauncher_full_bootstrap.sql
```

File này bao gồm schema `ads_launcher`, tables, indexes, triggers, RLS policies, các bảng mới từ migration và Storage bucket `ad-media`. Không cần chạy thêm migration nếu file bootstrap đã được cập nhật theo repo hiện tại.

### Cảnh báo backup bắt buộc

Database hiện đang nằm trên Mac Mini tại văn phòng. Đây là máy cá nhân/local machine, không phải server chạy 24/7. Nếu Mac Mini hỏng, mất điện, mất mạng hoặc database corrupt mà không có backup ngoài máy đó thì có thể mất sạch dữ liệu store, user, launch history và báo cáo.

Backup là bắt buộc, không phải tùy chọn. Đọc hướng dẫn chi tiết tại:

```text
docs/DATABASE_BACKUP_RESTORE.md
```

## 8. Build Production Không Dùng Docker

Dùng khi chạy trực tiếp bằng Node.js:

```bash
npm ci
npm run typecheck
npm run build
npm run start
```

Trên Windows nếu cần:

```powershell
npm.cmd ci
npm.cmd run typecheck
npm.cmd run build
npm.cmd run start
```

App sẽ chạy ở:

```text
http://localhost:3000
```

Muốn app tự chạy lại sau khi máy restart thì nên dùng Docker Compose, PM2 hoặc systemd. Cách khuyến nghị trong repo này là Docker Compose.

## 9. Chạy Production Bằng Docker Compose

Đây là cách khuyến nghị để chạy thật trên server/Mac Mini.

Hướng dẫn deploy chi tiết cho Mac Mini nằm ở:

```text
docs/MACMINI_DEPLOY.md
```

### Bước 1: Chuẩn bị file `.env`

Copy từ file mẫu:

```bash
cp .env.example .env
```

Trên Windows:

```powershell
Copy-Item .env.example .env
```

Sau đó mở `.env` và điền toàn bộ secret production thật.

Nếu có file env production từ đội bàn giao:

```bash
cp handover-private/.env.docker.production .env
```

Trên Windows:

```powershell
Copy-Item handover-private\.env.docker.production .env
```

### Bước 2: Build Docker image

```bash
docker compose build
```

### Bước 3: Chạy app

```bash
docker compose up -d
```

### Bước 4: Kiểm tra container

```bash
docker compose ps
```

Xem log:

```bash
docker compose logs -f adlauncher
```

Mở app:

```text
http://localhost:3000
```

Nếu server có domain/reverse proxy, mở domain production đã cấu hình, ví dụ:

```text
https://your-domain.com
```

## 10. Khởi Động Lại App Khi Máy/Server Bị Tắt

File `docker-compose.yml` đã có:

```yaml
restart: unless-stopped
```

Nghĩa là nếu Docker daemon tự chạy khi máy bật lại, container cũng sẽ tự chạy lại.

Sau khi máy bật lên, kiểm tra:

```bash
docker compose ps
```

Nếu container chưa chạy:

```bash
docker compose up -d
```

Restart app thủ công:

```bash
docker compose restart adlauncher
```

Xem log sau khi restart:

```bash
docker compose logs -f adlauncher
```

Dừng app:

```bash
docker compose down
```

Chạy lại:

```bash
docker compose up -d
```

## 11. Update Code Mới Lên Production

Khi có code mới trên Git:

```bash
git pull
docker compose build
docker compose up -d
docker compose logs -f adlauncher
```

Nếu chạy không dùng Docker:

```bash
git pull
npm ci
npm run typecheck
npm run build
npm run start
```

## 12. Health Check

Local:

```bash
curl http://localhost:3000/api/health
```

Production:

```bash
curl https://your-domain.com/api/health
```

Kết quả đúng có dạng:

```json
{
  "ok": true,
  "service": "adlauncher",
  "timestamp": "2026-05-26T00:00:00.000Z",
  "env": "production"
}
```

Nếu health check lỗi hoặc app bị sập, xem quy trình xử lý cơ bản trong:

```text
docs/MACMINI_DEPLOY.md
```

## 13. OAuth Callback URLs

Khi cấu hình Lark và Meta, callback URL phải đúng domain app.

Lark:

```text
https://your-domain.com/api/auth/lark/callback
```

Meta/Facebook:

```text
https://your-domain.com/api/auth/facebook/callback
```

Nếu đổi domain production, cần đổi ở:

- `.env`: `NEXT_PUBLIC_APP_URL`
- Lark Developer Console
- Meta Developer Console
- Reverse proxy/DNS/SSL

## 14. Cron Jobs

App có cron endpoints cần `CRON_SECRET`:

| Endpoint | Công dụng |
|---|---|
| `/api/cron/upload-to-facebook` | Upload video pending từ Supabase Storage lên Meta. |
| `/api/cron/activate-scheduled-ads` | Active/pause ads theo lịch đã đặt. |

Gọi thủ công để test:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/upload-to-facebook
```

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/activate-scheduled-ads
```

Trong production, nên cấu hình cron thật bằng Vercel Cron, server cron, Supabase pg_cron hoặc một scheduler nội bộ tùy hạ tầng.

## 15. Backup Và Restore Database

Repo có script:

```text
scripts/backup-db.sh
scripts/restore-db.sh
```

File hướng dẫn đầy đủ:

```text
docs/DATABASE_BACKUP_RESTORE.md
```

Backup:

```bash
DATABASE_URL='postgresql://user:password@host:5432/postgres' ./scripts/backup-db.sh
```

Restore:

```bash
DATABASE_URL='postgresql://user:password@host:5432/postgres' ./scripts/restore-db.sh backups/adlauncher-YYYYmmdd-HHMMSS.dump
```

Trước khi restore production, nên test restore trên môi trường staging hoặc database clone.

Dữ liệu quan trọng cần ưu tiên backup:

- User/team/org: `accounts`, `profiles`, `organizations`, `org_members`.
- Kết nối Meta: `facebook_connections`, `business_managers`, `pages`, `ad_accounts`, `page_links`.
- Store/creative assets: `creatives`, `ad_media`, `asset_boards`, `board_assets`, `creative_requests`.
- Launch/report: `launch_batches`, `scheduled_activations`, `launch_drafts`, `meta_api_cache`.
- Automations/comments/settings: `comments`, `comment_automations`, `automations`, `org_ai_keys`, `mcp_api_keys`, `naming_schemas`.

Nếu Supabase Storage `ad-media` cũng nằm trên Mac Mini/self-hosted, phải backup cả storage files/volume. Database chỉ lưu metadata/path, không thay thế được file media thật.

## 16. Checklist Bàn Giao

Trước khi bàn giao chính thức, nên kiểm tra:

- Source code đã được đưa lên Git của công ty.
- Tài khoản/quyền truy cập đã được bàn giao theo file:

```text
docs/ACCESS_AND_OWNERSHIP.md
```

- Tất cả dịch vụ bên thứ ba app đang dùng phải đứng tên công ty hoặc có admin công ty: Lark, Supabase/Postgres, domain/DNS, hosting/server/Mac Mini, Meta Developer App, Meta Business Manager, Google Cloud, Resend, OpenAI/Gemini, Cloudflare nếu có.
- Không để app phụ thuộc vào email/tài khoản cá nhân của người bàn giao.
- Không gửi mật khẩu thật, API key hay secret qua README, chat thường hoặc email plain text. Dùng password manager/secret manager của công ty hoặc bàn giao trực tiếp.
- Sau khi nhận bàn giao, công ty cần đổi/rotate toàn bộ secret quan trọng: Supabase service role key, database password, `CUSTOM_AUTH_SECRET`, `CRON_SECRET`, Lark/Meta/Google secrets, Resend/OpenAI/Gemini keys.
- `.env`, `.env.local`, `handover-private/` và mọi secret thật không bị commit lên Git.
- Supabase project/database thuộc quyền công ty.
- Meta app, Business Manager, ad accounts, pages thuộc quyền công ty.
- Lark app OAuth thuộc quyền công ty.
- Domain/DNS/SSL/reverse proxy thuộc quyền công ty.
- `NEXT_PUBLIC_APP_URL` đúng domain production.
- Lark callback URL và Meta callback URL đúng domain production.
- `npm run typecheck` pass.
- `npm run build` pass.
- `docker compose build` pass.
- `docker compose up -d` chạy được.
- `/api/health` trả về `ok: true`.
- Có lịch backup database định kỳ.
- Đã test restore database ít nhất một lần trên môi trường thử nghiệm.

## 17. Lệnh Hay Dùng

```bash
# Local dev
npm run dev

# TypeScript check
npm run typecheck

# Production build
npm run build

# Start production build without Docker
npm run start

# Docker build
docker compose build

# Docker start/recreate
docker compose up -d

# Docker restart
docker compose restart adlauncher

# Docker logs
docker compose logs -f adlauncher

# Docker stop
docker compose down
```
