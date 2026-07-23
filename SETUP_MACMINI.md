# Setup AdLauncher trên Mac mini — Hướng dẫn từng bước

**Mục tiêu:** Mở Mac mini → paste 1 lệnh → app chạy production.

---

## Yêu cầu trước khi bắt đầu

| Yêu cầu | Ghi chú |
|---|---|
| Mac mini M-series (M1/M2/M4) | Tốt nhất, ARM native |
| macOS 13+ | Cho colima/Docker |
| Kết nối internet office | Để pull image + gọi Meta/Supabase |
| Quyền `sudo` | Cài Homebrew cần |
| `.env.local` từ máy dev | Để copy production secrets |

---

## Cách 1 — Nhanh nhất: paste 1 lệnh (RECOMMENDED)

Mở **Terminal** trên Mac mini, paste:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/dev-pati/New-Ads-Launcher/main/scripts/setup-macmini.sh)
```

> ⚠️ Chỉ chạy được sau khi đã push [scripts/setup-macmini.sh](scripts/setup-macmini.sh) lên GitHub branch `main`.

Script tự làm 8 việc:
1. Cài Homebrew (nếu thiếu)
2. Cài Docker (colima) + Git
3. Clone repo về `~/Developer/AdLauncher`
4. Tạo `.env` từ template — **dừng hỏi bạn điền secrets**
5. Build + chạy Docker (3–5 phút)
6. Cài crontab (scheduled ads/automations/metrics mỗi 5 phút)
7. Cài LaunchAgent (auto-restart + auto-deploy mỗi 2 phút)
8. Verify + in ra URL truy cập

Script sẽ **dừng ở bước 4** chờ bạn điền `.env`. Điền xong nhấn ENTER để tiếp.

---

## Cách 2 — Clone rồi chạy local (nếu curl bị chặn)

```bash
# 1. Clone
git clone https://github.com/dev-pati/New-Ads-Launcher.git ~/Developer/AdLauncher
cd ~/Developer/AdLauncher

# 2. Chạy setup
bash scripts/setup-macmini.sh
```

---

## Bước quan trọng: điền `.env`

Script tạo `.env` từ `.env.example` rồi dừng. Bạn phải mở file và điền:

```bash
nano ~/Developer/AdLauncher/.env
# hoặc mở bằng VS Code:
code ~/Developer/AdLauncher/.env
```

**Các biến BẮT BUỘC (app không chạy thiếu):**

| Biến | Lấy từ đâu |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → Connection string |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → `service_role` key |
| `CUSTOM_AUTH_SECRET` | Generate: `openssl rand -base64 32` |
| `JWT_SECRET` | Generate: `openssl rand -base64 32` |

**Tự sinh:**
- `CRON_SECRET` — script tự generate nếu rỗng.

**App URL:**
- `APP_URL=http://localhost:3000` (script set sẵn, dùng cho cron local)
- `NEXT_PUBLIC_APP_URL` — nếu truy cập qua LAN: `http://<IP-MAC-MINI>:3000`; qua domain: `https://ads.domain.com`

**Cách nhanh nhất copy secrets từ máy dev:**
```bash
# Trên máy dev (Windows/WSL):
scp "C:\Users\PATI Work\Documents\PATI Work\Adlauncher Apps\New-Ads-Launcher\.env.local" \
    user@<IP-MAC-MINI>:~/Developer/AdLauncher/.env
```
Rồi sửa `APP_URL` / `NEXT_PUBLIC_APP_URL` cho đúng môi trường Mac mini.

---

## Sau khi setup xong

### Truy cập app
```
http://localhost:3000          # trên Mac mini
http://<IP-MAC-MINI>:3000      # máy khác trong office LAN
```
Tìm IP Mac mini: `ipconfig getifaddr en0`

### Các lệnh thường dùng

```bash
cd ~/Developer/AdLauncher

# Xem log app
docker compose logs -f adlauncher

# Xem log cron (scheduled ads/automations)
tail -f /tmp/adlauncher-cron.log

# Xem log auto-deploy
tail -f /tmp/adlauncher-deploy.log

# Restart app
docker compose restart

# Stop / start
docker compose down
docker compose up -d

# Check trạng thái
docker compose ps
docker stats adlauncher-web
```

### Update code (flow hằng ngày)

```bash
# Trên máy dev:
git add -A && git commit -m "..." && git push

# Mac mini TỰ động: LaunchAgent pull + rebuild trong ≤2 phút
# Không cần làm gì!
```

Muốn deploy ngay không đợi 2 phút:
```bash
cd ~/Developer/AdLauncher && bash scripts/auto-deploy.sh
```

---

## Bước tùy chọn

### A. HTTPS + domain (nếu truy cập ngoài office)

```bash
brew install caddy
cp scripts/Caddyfile.example /opt/homebrew/etc/Caddyfile
nano /opt/homebrew/etc/Caddyfile    # sửa "ads.tencongty.com" thành domain thật
brew services start caddy
```
Yêu cầu: trỏ DNS domain → IP public Mac mini + mở port 80/443 trên router.

### B. Backup database (hằng đêm)

Có sẵn [scripts/backup-db.sh](scripts/backup-db.sh). Thêm vào crontab:
```bash
crontab -e
# Backup mỗi đêm 2h:
0 2 * * * ~/Developer/AdLauncher/scripts/backup-db.sh >> /tmp/adlauncher-backup.log 2>&1
```

---

## Xử lý sự cố

| Triệu chứng | Xử lý |
|---|---|
| `docker compose up` fail | `docker info` chạy được không? colima start lại: `colima restart` |
| App không respond sau build | `docker compose logs adlauncher` — thường do thiếu env var |
| Cron HTTP 401 | `CRON_SECRET` trong `.env` khác trong `~/.adlauncher.env`. Chạy lại setup hoặc sửa thủ công |
| Scheduled ads không chạy | `tail /tmp/adlauncher-cron.log` xem endpoint nào lỗi |
| Build chậm lần đầu | Bình thường (pull image + npm ci). Lần sau dùng cache, ~1 phút |
| Port 3000 bị chiếm | Sửa `docker-compose.yml` → `"3001:3000"`, đổi `APP_URL` |
| App chết sau reboot | Check LaunchAgent: `tail /tmp/adlauncher-autostart.err`. colima cần `colima start` tự động — xem mục colima autostart bên dưới |

### colima auto-start khi boot (nếu LaunchAgent báo Docker chưa sẵn sàng)
```bash
brew services start colima
```
`brew services` cài LaunchAgent cho colima, tự start khi login.

---

## Kiểm tra health tổng thể

```bash
echo "=== Container ==="      && docker compose ps
echo "=== App health ==="     && curl -s http://localhost:3000/api/health
echo "=== Cron log cuối ==="  && tail -3 /tmp/adlauncher-cron.log
echo "=== Disk ==="           && df -h | grep -E "Filesystem|/$"
echo "=== Docker disk ==="    && docker system df
```

Tất cả green = production healthy.

---

## Tóm tắt kiến trúc sau setup

```
Mac mini (office)
├─ macOS
│  ├─ colima (Docker engine, auto-start via brew services)
│  │  └─ adlauncher-web container (:3000)
│  │     └─ Next.js standalone
│  ├─ crontab → scripts/cron-adlauncher.sh (mỗi 5 phút)
│  │           gọi /api/cron/* với CRON_SECRET
│  └─ LaunchAgent com.adlauncher.autostart
│     ├─ scripts/auto-deploy.sh (mỗi 2 phút: pull + rebuild nếu code mới)
│     └─ restart khi boot
│
└─ → Supabase cloud (DB, shared project vrnstjkxumaaduqswkji)
    → Meta Graph API (ads, pages)
```
