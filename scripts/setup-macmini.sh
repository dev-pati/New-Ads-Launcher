#!/bin/bash
# =============================================================================
# AdLauncher — Mac mini production setup (run once on a fresh Mac mini)
# =============================================================================
# Mở Terminal trên Mac mini, paste cả lệnh này vào:
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/dev-pati/New-Ads-Launcher/main/scripts/setup-macmini.sh)
#
# Hoặc clone trước rồi chạy local:
#   git clone https://github.com/dev-pati/New-Ads-Launcher.git ~/Developer/AdLauncher
#   cd ~/Developer/AdLauncher
#   bash scripts/setup-macmini.sh
#
# Script làm:
#   1. Cài Homebrew (nếu thiếu)
#   2. Cài Docker (colima) + Git
#   3. Clone repo (nếu chưa có)
#   4. Hỏi lấy CRON_SECRET, tạo .env từ template
#   5. Build + chạy Docker
#   6. Cài crontab (scheduled ads/automations/metrics)
#   7. Cài LaunchAgent (auto-restart + auto-deploy)
#   8. Verify tất cả
# =============================================================================

set -uo pipefail

REPO_URL="https://github.com/dev-pati/New-Ads-Launcher.git"
INSTALL_DIR="${INSTALL_DIR:-$HOME/Developer/AdLauncher}"
BRANCH="${BRANCH:-main}"

# --- màu ---
green() { printf "\033[32m%s\033[0m\n" "$1"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
step()  { printf "\n\033[1;36m▶ %s\033[0m\n" "$1"; }
ok()    { green "  ✓ $1"; }
die()   { red "  ✗ $1"; exit 1; }

# --- yêu cầu tương tác ---
[ -t 0 ] || die "Chạy script trong Terminal tương tác (không pipe)."

# =============================================================================
step "1/8 — Homebrew"
# =============================================================================
if command -v brew &>/dev/null; then
  ok "Homebrew đã cài"
else
  yellow "Cài Homebrew (cần sudo, sẽ hỏi password)..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" \
    || die "Cài Homebrew thất bại"
  # Apple Silicon: add to PATH
  if [ -f /opt/homebrew/bin/brew ]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  fi
  ok "Homebrew xong"
fi

# =============================================================================
step "2/8 — Docker (colima) + Git"
# =============================================================================
if ! command -v git &>/dev/null; then
  brew install git || die "Cài git thất bại"
  ok "git"
else ok "git đã có"; fi

if command -v docker &>/dev/null && docker info &>/dev/null 2>&1; then
  ok "Docker đang chạy"
else
  yellow "Cài colima (Docker nhẹ, không GUI)..."
  brew install colima docker || die "Cài colima thất bại"
  yellow "Khởi động colima (2-3 phút lần đầu)..."
  colima start --cpu 4 --memory 8 --disk 50 || die "colima start thất bại"
  ok "Docker xong"
fi

# =============================================================================
step "3/8 — Clone repo"
# =============================================================================
if [ -d "$INSTALL_DIR/.git" ]; then
  ok "Repo đã có tại $INSTALL_DIR"
  cd "$INSTALL_DIR"
else
  mkdir -p "$(dirname "$INSTALL_DIR")"
  git clone -b "$BRANCH" "$REPO_URL" "$INSTALL_DIR" || die "clone thất bại"
  cd "$INSTALL_DIR"
  ok "Clone xong → $INSTALL_DIR"
fi
APP_DIR="$(pwd)"

# =============================================================================
step "4/8 — .env (bắt buộc, không commit)"
# =============================================================================
if [ ! -f "$APP_DIR/.env" ]; then
  if [ -f "$APP_DIR/.env.example" ]; then
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    yellow ".env tạo từ .env.example."
  else
    touch "$APP_DIR/.env"
    yellow ".env tạo rỗng."
  fi
  red "  ⚠️  BẮT BUỘC: mở $APP_DIR/.env và điền production values."
  red "      Tối thiểu: DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,"
  red "                SUPABASE_SERVICE_ROLE_KEY, CUSTOM_AUTH_SECRET, JWT_SECRET."
  red "  (Copy từ .env.local ở máy dev qua scp, hoặc 1Password.)"
  printf "\n  Nhấn ENTER khi đã điền xong .env... "
  read -r
else
  ok ".env đã có"
fi

# đảm bảo CRON_SECRET có giá trị, sinh nếu rỗng
if ! grep -q "^CRON_SECRET=.\+" "$APP_DIR/.env"; then
  SECRET=$(openssl rand -hex 32)
  if grep -q "^CRON_SECRET=" "$APP_DIR/.env"; then
    sed -i '' "s|^CRON_SECRET=.*|CRON_SECRET=$SECRET|" "$APP_DIR/.env"
  else
    echo "CRON_SECRET=$SECRET" >> "$APP_DIR/.env"
  fi
  yellow "CRON_SECRET tự sinh: $SECRET"
fi
CRON_SECRET=$(grep -E "^CRON_SECRET=" "$APP_DIR/.env" | head -1 | cut -d= -f2)

# APP_URL default local
if ! grep -q "^APP_URL=.\+" "$APP_DIR/.env"; then
  echo "APP_URL=http://localhost:3000" >> "$APP_DIR/.env"
fi

# =============================================================================
step "5/8 — Build + chạy Docker"
# =============================================================================
yellow "Build image (3-5 phút lần đầu)..."
docker compose up -d --build || die "docker compose up thất bại"
sleep 8
if curl -sf http://localhost:3000/api/health >/dev/null 2>&1; then
  ok "App đang chạy — http://localhost:3000"
else
  yellow "App chưa ready, đợi thêm 15s..."
  sleep 15
  curl -sf http://localhost:3000/api/health >/dev/null 2>&1 && ok "App ready" || die "App không respond. Chạy: docker compose logs adlauncher"
fi

# =============================================================================
step "6/8 — Cron scheduler (scheduled ads/automations/metrics)"
# =============================================================================
chmod +x "$APP_DIR/scripts/cron-adlauncher.sh"

# env file cho cron (chạy ngoài container, không thấy .env trong compose)
CRON_ENV="$HOME/.adlauncher.env"
cat > "$CRON_ENV" <<EOF
APP_URL=http://localhost:3000
CRON_SECRET=$CRON_SECRET
EOF
chmod 600 "$CRON_ENV"
ok "Cron env → $CRON_ENV"

# test cron thủ công 1 lần
yellow "Test cron (gọi 1 endpoint)..."
TEST_CODE=$(curl -s -o /dev/null -w "%{http_code}" -m 60 \
  -H "Authorization: Bearer $CRON_SECRET" \
  "http://localhost:3000/api/cron/activate-scheduled-ads")
if [ "$TEST_CODE" = "200" ]; then
  ok "Cron endpoint respond 200"
else
  yellow "Cron trả HTTP $TEST_CODE (OK nếu endpoint cần param, check /tmp/adlauncher-cron.log sau khi crontab chạy)"
fi

# cài crontab — merge không ghi đè job có sẵn
CRON_LINE="*/5 * * * * $APP_DIR/scripts/cron-adlauncher.sh >> /tmp/adlauncher-cron.log 2>&1"
( crontab -l 2>/dev/null | grep -v "cron-adlauncher.sh" ; echo "$CRON_LINE" ) | crontab -
ok "Crontab cài (mỗi 5 phút)"

# =============================================================================
step "7/8 — LaunchAgent (auto-restart + auto-deploy)"
# =============================================================================
LAUNCH_DIR="$HOME/Library/LaunchAgents"
mkdir -p "$LAUNCH_DIR"
# rewrite plist với APP_DIR thật
sed "s|\$HOME/Developer/AdLauncher/New-Ads-Launcher|$APP_DIR|g" \
  "$APP_DIR/scripts/com.adlauncher.autostart.plist" > "$LAUNCH_DIR/com.adlauncher.autostart.plist"
launchctl unload "$LAUNCH_DIR/com.adlauncher.autostart.plist" 2>/dev/null
launchctl load "$LAUNCH_DIR/com.adlauncher.autostart.plist"
ok "LaunchAgent load (auto-deploy mỗi 2 phút + restart khi boot)"

# =============================================================================
step "8/8 — Verify"
# =============================================================================
echo ""
green "════════════════════════════════════════════════════"
green "  SETUP XONG — AdLauncher production trên Mac mini"
green "════════════════════════════════════════════════════"
echo ""
printf "  App:        \033[4mhttp://localhost:3000\033[0m\n"
printf "  LAN:        \033[4mhttp://%s:3000\033[0m\n" "$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || echo '<mac-mini-ip>')"
printf "  Repo:       %s\n" "$APP_DIR"
printf "  Logs app:   docker compose logs -f adlauncher\n"
printf "  Logs cron:  tail -f /tmp/adlauncher-cron.log\n"
printf "  Logs deploy:tail -f /tmp/adlauncher-deploy.log\n"
printf "  Update code:git push (máy dev) → Mac mini tự pull+rebuild trong 2 phút\n"
echo ""
yellow "  BƯỚC CUỐI TÙY CHỌN:"
echo "  • Mở port 3000 trên router nếu truy cập ngoài office"
echo "  • Cài Caddy + domain nếu cần HTTPS (xem scripts/Caddyfile.example)"
echo ""
