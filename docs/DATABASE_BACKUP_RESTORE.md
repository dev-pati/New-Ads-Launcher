# Database Backup And Restore

Tai lieu nay huong dan dung lai cau truc database, backup du lieu dinh ky va restore khi co su co.

## 1. Canh Bao Rui Ro Bat Buoc Doc

Database hien dang nam tren Mac Mini tai van phong. Day la may ca nhan/local machine, khong phai server/datacenter chay 24/7.

Rui ro thuc te:

- Mac Mini hong o cung hoac loi he dieu hanh.
- Mat dien dot ngot lam database corrupt.
- Mat mang khien app khong truy cap duoc DB.
- Ai do tat may, restart may, update Docker/Supabase sai cach.
- Khong co ban backup ngoai may do thi mat du lieu vinh vien.

Vi vay backup la bat buoc, khong phai tuy chon. It nhat phai co backup tu dong hang ngay va ban backup phai duoc copy ra ngoai Mac Mini.

## 2. File SQL Dung Lai Database Tu Dau

Repo co mot file SQL duy nhat de dung lai toan bo cau truc database app tu dau:

```text
supabase/adlauncher_full_bootstrap.sql
```

File nay bao gom:

- Schema `ads_launcher`.
- Tables, indexes, triggers, grants, RLS policies.
- Custom auth tables: `accounts`, `profiles`.
- Cac bang moi tu migrations: `launch_drafts`, `google_connections`, `meta_api_cache`.
- Supabase Storage bucket va policies cho `ad-media`.

Chay tren database trong:

```bash
psql "$DATABASE_URL" -f supabase/adlauncher_full_bootstrap.sql
```

Canh bao: file nay co phan drop/recreate object trong schema `ads_launcher`. Khong chay vao production dang co du lieu neu chua co backup da verify.

Repo van giu schema snapshot va migrations rieng de tra cuu lich su:

```text
supabase/schema.sql
supabase/schema.ads_launcher.sql
supabase/migrations/
```

Schema chinh app dung:

```text
ads_launcher
```

## 3. Du Lieu Quan Trong Can Backup

Uu tien backup toan bo schema `ads_launcher`. Cac nhom du lieu quan trong nhat:

| Nhom du lieu | Bang lien quan | Vi sao quan trong |
|---|---|---|
| User va team | `accounts`, `profiles`, `organizations`, `org_members`, `org_invitations` | Mat la mat tai khoan, workspace, quyen truy cap. |
| Ket noi Meta | `facebook_connections`, `business_managers`, `pages`, `ad_accounts`, `page_links` | Mat la phai connect lai, anh huong launch/report. |
| Creative/store assets | `creatives`, `ad_media`, `asset_boards`, `board_assets`, `creative_requests` | Day la du lieu store/media library nguoi dung thao tac hang ngay. |
| Launch history | `launch_batches`, `scheduled_activations`, `ads`, `launch_drafts` | Mat lich su launch, scheduled ads, draft dang lam. |
| Report/insights/cache | `meta_api_cache`, insights-related records neu co | Mat cache/report lam app phai goi lai Meta nhieu hon, de rate limit. |
| Automations/comments | `comments`, `comment_automations`, `automation_runs`, `automations`, `automation_executions`, `automation_approvals`, `budget_schedules` | Mat workflow, lich su automation, comment handling. |
| Settings/API keys | `user_settings`, `org_ai_keys`, `mcp_api_keys`, `mcp_oauth_*`, `naming_schemas`, `ad_set_presets`, `ad_copy_templates` | Mat cau hinh van hanh, AI keys theo org, MCP/API access. |
| Google/Inspo | `google_connections`, `inspo_saved_ads`, `inspo_boards`, `inspo_board_saves` | Mat Google connection va saved ads/boards nguoi dung da luu. |

Ngoai database, neu Supabase Storage `ad-media` nam cung Mac Mini/self-hosted thi phai backup ca storage volume/object files. Database chi luu metadata/path; file anh/video that co the nam trong storage.

## 4. Backup Thu Cong

Script co san:

```text
scripts/backup-db.sh
```

Yeu cau may chay lenh co `pg_dump`.

Chay backup:

```bash
DATABASE_URL='postgresql://user:password@host:5432/postgres' ./scripts/backup-db.sh
```

Mac dinh file backup duoc ghi vao:

```text
backups/adlauncher-YYYYmmdd-HHMMSS.dump
```

Doi thu muc backup:

```bash
BACKUP_DIR='/path/to/backup-folder' DATABASE_URL='postgresql://user:password@host:5432/postgres' ./scripts/backup-db.sh
```

Script hien backup schema:

```text
ads_launcher
```

Dinh dang backup la custom format cua PostgreSQL, restore bang `pg_restore`.

## 5. Restore Du Lieu

Script co san:

```text
scripts/restore-db.sh
```

Canh bao: restore se dung `pg_restore --clean --if-exists`, nghia la co the xoa/thay the object trong database dich. Khong chay vao production neu chua chac chan.

Restore:

```bash
DATABASE_URL='postgresql://user:password@host:5432/postgres' ./scripts/restore-db.sh backups/adlauncher-YYYYmmdd-HHMMSS.dump
```

Quy trinh restore an toan:

1. Tao database staging/test hoac clone database moi.
2. Restore file backup vao database do.
3. Chay app tro vao database test.
4. Kiem tra login, orgs, assets, launch history, insights.
5. Chi restore production khi da xac nhan file backup tot.

## 6. Backup Dinh Ky Tren Mac Mini

Khuyen nghi toi thieu:

- Backup database moi ngay.
- Giu it nhat 14-30 ban gan nhat.
- Copy backup ra ngoai Mac Mini: Google Drive, NAS, S3, external disk hoac server khac.
- Test restore moi thang mot lan.

Vi du cron tren Mac Mini/Linux:

```bash
crontab -e
```

Them job chay luc 02:00 moi ngay:

```cron
0 2 * * * cd /path/to/AdLauncher-master && BACKUP_DIR=/path/to/adlauncher-backups DATABASE_URL='postgresql://user:password@host:5432/postgres' ./scripts/backup-db.sh >> /path/to/adlauncher-backups/backup.log 2>&1
```

Vi du xoa backup cu hon 30 ngay:

```cron
30 2 * * * find /path/to/adlauncher-backups -name 'adlauncher-*.dump' -mtime +30 -delete
```

Neu dung macOS LaunchAgent/LaunchDaemon thay vi cron, van chay cung command backup o tren.

## 7. Backup Storage `ad-media`

Neu Supabase Storage self-hosted cung nam tren Mac Mini, can backup storage volume. Kiem tra Docker volume hoac folder mount cua Supabase Storage roi copy dinh ky ra ngoai may.

Vi du dung `rsync`:

```bash
rsync -a --delete /path/to/supabase/storage/ /path/to/storage-backups/ad-media/
```

Neu storage dang o Supabase Cloud thi kiem tra chinh sach backup/object lifecycle cua Supabase Cloud.

## 8. Kiem Tra Backup Co Dung Duoc Khong

Mot ban backup chi duoc xem la tot khi da restore thu thanh cong.

Checklist kiem tra:

- `pg_restore` khong loi nghiem trong.
- App login duoc.
- Organization/member con du.
- Assets/boards con du lieu.
- Launch history con du lieu.
- Meta connections/ad accounts/pages con du lieu.
- Scheduled ads con du lieu.
- Insights/report khong crash.

## 9. Lenh Nhanh

Dung lai DB trong tu mot file SQL:

```bash
psql "$DATABASE_URL" -f supabase/adlauncher_full_bootstrap.sql
```

Backup:

```bash
DATABASE_URL='postgresql://user:password@host:5432/postgres' ./scripts/backup-db.sh
```

Restore:

```bash
DATABASE_URL='postgresql://user:password@host:5432/postgres' ./scripts/restore-db.sh backups/adlauncher-YYYYmmdd-HHMMSS.dump
```
