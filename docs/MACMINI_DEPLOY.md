# Mac Mini Production Deploy

Tai lieu nay huong dan dua AdLauncher len chay that tren Mac Mini cua cong ty bang Docker Compose.

## 1. Cau Hinh Toi Thieu

Khuyen nghi toi thieu cho Mac Mini:

| Hang muc | Khuyen nghi |
|---|---|
| CPU | Apple Silicon hoac Intel Mac Mini doi moi |
| RAM | 16 GB tro len |
| Disk | 256 GB tro len, con trong it nhat 50 GB |
| OS | macOS ban moi, duoc update bao mat |
| Network | Mang on dinh, co IP/domain truy cap duoc tu ben ngoai neu chay production |
| Runtime | Docker Desktop hoac Docker Engine/Colima |
| Git | Da cai Git |
| Node.js | Khong bat buoc neu chi chay Docker, nhung nen co Node 20+ de debug |
| Postgres tools | `psql`, `pg_dump`, `pg_restore` de backup/restore DB |

Mac Mini nen duoc cau hinh:

- Khong sleep khi cam dien.
- Tu khoi dong lai sau mat dien neu co the.
- Docker tu chay khi user dang nhap hoac khi may boot.
- Co backup database va storage ra ngoai Mac Mini.

## 2. Chuan Bi Tren Mac Mini

Vao folder muon dat source code:

```bash
cd ~
git clone <company-repo-url> AdLauncher-master
cd ~/AdLauncher-master
```

Neu repo da co san:

```bash
cd ~/AdLauncher-master
git pull
```

Kiem tra cac file bat buoc:

```bash
ls -la Dockerfile docker-compose.yml .dockerignore .env.example package.json
```

## 3. Cau Hinh File `.env`

Production Docker Compose doc file:

```text
.env
```

Tao tu file mau:

```bash
cp .env.example .env
```

Sau do dien gia tri that vao `.env`.

Bien toi thieu bat buoc:

```text
NEXT_PUBLIC_APP_URL
APP_URL
CUSTOM_AUTH_SECRET
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SUPABASE_DB_SCHEMA
SUPABASE_SERVICE_ROLE_KEY
LARK_APP_ID
LARK_APP_SECRET
NEXT_PUBLIC_FACEBOOK_APP_ID
FACEBOOK_APP_ID
FACEBOOK_APP_SECRET
CRON_SECRET
```

Bien tuy tinh theo tinh nang:

```text
RESEND_API_KEY
NEXT_PUBLIC_GOOGLE_CLIENT_ID
NEXT_PUBLIC_GOOGLE_API_KEY
GOOGLE_CLIENT_SECRET
OPENAI_API_KEY
GEMINI_API_KEY
CF_ACCESS_CLIENT_ID
CF_ACCESS_CLIENT_SECRET
```

Khong commit `.env` len Git.

## 4. Database Truoc Khi Chay App

Neu database da ton tai va co data that, khong chay bootstrap SQL vao DB production.

Neu can dung DB moi/trong tu dau:

```bash
psql "$DATABASE_URL" -f supabase/adlauncher_full_bootstrap.sql
```

Neu DB da co san nhung chua co cache table cho Meta API:

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260526_meta_api_cache.sql
```

Can backup truoc moi thao tac database quan trong:

```bash
DATABASE_URL='postgresql://user:password@host:5432/postgres' ./scripts/backup-db.sh
```

Doc them:

```text
docs/DATABASE_BACKUP_RESTORE.md
```

## 5. Build Va Chay App Bang Docker Compose

Build image:

```bash
docker compose build
```

Chay container:

```bash
docker compose up -d
```

Kiem tra trang thai:

```bash
docker compose ps
```

Neu dung file `docker-compose.yml` hien tai, service ten la:

```text
adlauncher
```

Container ten la:

```text
adlauncher-web
```

Xem log:

```bash
docker compose logs -f adlauncher
```

Mac Mini se expose app o port:

```text
3000
```

Local tren Mac Mini:

```text
http://localhost:3000
```

Production domain se phu thuoc reverse proxy/DNS, vi du:

```text
https://your-domain.com
```

## 6. Tu Khoi Dong Lai Khi Mac Mini Bat Lai

Trong `docker-compose.yml` da co:

```yaml
restart: unless-stopped
```

Nghia la container se tu restart neu bi crash, va se tu chay lai khi Docker daemon chay lai sau khi Mac Mini boot.

Can dam bao Docker tu chay khi may boot:

- Docker Desktop: bat setting `Start Docker Desktop when you sign in`.
- Neu dung Colima/launchd: tao LaunchAgent/LaunchDaemon de chay Colima/Docker khi boot.
- Trong macOS Energy settings: tat sleep khi cam dien.

Sau khi Mac Mini restart, kiem tra:

```bash
cd ~/AdLauncher-master
docker compose ps
```

Neu container chua chay:

```bash
docker compose up -d
```

## 7. Health Check

Kiem tra local tren Mac Mini:

```bash
curl http://localhost:3000/api/health
```

Kiem tra qua domain production:

```bash
curl https://your-domain.com/api/health
```

Ket qua dung:

```json
{
  "ok": true,
  "service": "adlauncher",
  "timestamp": "2026-05-26T00:00:00.000Z",
  "env": "production"
}
```

Kiem tra container:

```bash
docker compose ps
```

Trang thai mong muon:

```text
STATUS: Up
PORTS: 0.0.0.0:3000->3000/tcp
```

## 8. Xu Ly Co Ban Khi App Loi/Sap

### Xem log app

```bash
docker compose logs --tail 200 adlauncher
```

Theo doi log realtime:

```bash
docker compose logs -f adlauncher
```

### Restart app

```bash
docker compose restart adlauncher
```

### Rebuild va chay lai

Dung khi vua pull code moi hoac build cu loi:

```bash
git pull
docker compose build
docker compose up -d
docker compose logs -f adlauncher
```

### App khong len port 3000

Kiem tra container:

```bash
docker compose ps
```

Kiem tra port dang bi process nao dung:

```bash
lsof -i :3000
```

Neu port bi chiem, dung process cu hoac doi port trong `docker-compose.yml`:

```yaml
ports:
  - "3001:3000"
```

### Loi env/config

Dau hieu:

- Log bao missing `SUPABASE_SERVICE_ROLE_KEY`.
- Login redirect sai domain.
- Lark/Meta callback failed.
- Supabase request failed.

Kiem tra `.env`:

```bash
grep -E 'NEXT_PUBLIC_APP_URL|NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_DB_SCHEMA|LARK_APP_ID|FACEBOOK_APP_ID' .env
```

Khong in secret that ra terminal neu dang share man hinh/log.

Sau khi sua `.env`, restart container:

```bash
docker compose up -d
docker compose restart adlauncher
```

### Loi database

Kiem tra health truoc:

```bash
curl http://localhost:3000/api/health
```

Neu app len nhung man hinh loi data:

- Kiem tra `NEXT_PUBLIC_SUPABASE_URL`.
- Kiem tra `NEXT_PUBLIC_SUPABASE_DB_SCHEMA=ads_launcher`.
- Kiem tra `SUPABASE_SERVICE_ROLE_KEY`.
- Kiem tra DB co migration moi, dac biet `meta_api_cache`.

Neu can apply migration cache:

```bash
psql "$DATABASE_URL" -f supabase/migrations/20260526_meta_api_cache.sql
```

### Docker build loi

Thu build lai sach hon:

```bash
docker compose build --no-cache
docker compose up -d
```

Neu loi o `npm ci`, kiem tra internet/DNS tren Mac Mini va `package-lock.json` co ton tai.

## 9. Update Production

Quy trinh update:

```bash
cd ~/AdLauncher-master
git pull
docker compose build
docker compose up -d
curl http://localhost:3000/api/health
docker compose logs --tail 100 adlauncher
```

Neu update co migration database:

1. Backup DB truoc.
2. Chay migration.
3. Rebuild/restart app.
4. Kiem tra health va cac flow chinh.

## 10. Checklist Sau Deploy

- [ ] `docker compose ps` hien `adlauncher-web` dang `Up`.
- [ ] `curl http://localhost:3000/api/health` tra `ok: true`.
- [ ] Domain production mo duoc app.
- [ ] Login Lark duoc.
- [ ] Chon organization duoc.
- [ ] Connect Meta/Facebook duoc.
- [ ] Load ad accounts/pages duoc.
- [ ] Upload asset duoc.
- [ ] Insights/Ads Manager khong crash.
- [ ] Cron upload video co `CRON_SECRET`.
- [ ] Backup DB da cau hinh.
- [ ] Backup duoc copy ra ngoai Mac Mini.
