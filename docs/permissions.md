# Permissions & Roles — AdLauncher

> Nguồn: `supabase/schema.sql`  
> Cơ chế: **PostgreSQL RLS (Row Level Security)** + 2 helper function

---

## Các Role

Dùng PostgreSQL ENUM `org_role`, gắn vào bảng `org_members`:

| Role | Mô tả | Default |
|------|-------|---------|
| `admin` | Quản trị viên tổ chức | |
| `editor` | Thành viên thông thường | ✓ |

```sql
CREATE TYPE org_role AS ENUM ('admin', 'editor');
```

---

## Helper Functions

Hai function dùng trong mọi RLS policy:

```sql
-- Kiểm tra user hiện tại có thuộc org không
is_org_member(org_id UUID) → BOOLEAN

-- Kiểm tra user hiện tại có phải admin của org không
is_org_admin(org_id UUID) → BOOLEAN
```

Cả hai dùng `auth.uid()` của Supabase Auth để xác định user hiện tại.

---

## Ma trận quyền theo bảng

### Cá nhân (chỉ user của mình)

| Bảng | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| `profiles` | own + cùng org | — | own | — |
| `user_settings` | own | own | own | — |
| `notifications` | own | — | own | — |

---

### Tổ chức — Member làm được, Admin xóa

| Bảng | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| `facebook_connections` | member | member | member | **admin** |
| `business_managers` | member | member | member | **admin** |
| `pages` | member | member | member | **admin** |
| `ad_accounts` | member | member | member | **admin** |
| `page_links` | member | member | member | **admin** |
| `creatives` | member | member | member | **admin** |
| `ads` | member | member | member | **admin** |
| `ad_media` | member | member | — | **admin** |
| `asset_boards` | member | member | member | **admin** |
| `creative_requests` | member | member | member | **admin** |

---

### Tổ chức — Member toàn quyền (ALL)

| Bảng |
|------|
| `ad_set_presets` |
| `launch_batches` |
| `launch_drafts` |
| `scheduled_activations` |
| `ad_copy_templates` |
| `board_assets` |
| `comments` |
| `comment_automations` |
| `automations` |
| `automation_executions` |
| `automation_approvals` |
| `budget_schedules` |
| `mcp_api_keys` |
| `inspo_saved_ads` |
| `inspo_boards` |
| `inspo_board_saves` |
| `org_ai_keys` |
| `naming_schemas` |

---

### Admin only

| Bảng | Quyền |
|------|-------|
| `organizations` | UPDATE (chỉ admin mới sửa được org) |
| `org_invitations` | SELECT / INSERT / DELETE |
| `org_members` | INSERT (thêm người) / UPDATE / DELETE |

> Bất kỳ user nào cũng có thể **tạo org mới** (`INSERT organizations`) và **tự thêm mình** vào org mới tạo.

---

### Storage (bucket `ad-media`)

| Action | Ai được phép |
|--------|-------------|
| Đọc file | Public (không cần đăng nhập) |
| Upload | Authenticated |
| Update | Authenticated |
| Delete | Authenticated |

---

## Tóm tắt logic

```
User
 └── thuộc nhiều Org (qua org_members)
      └── mỗi Org có role: admin | editor

editor  → xem + tạo + sửa hầu hết mọi thứ trong org
admin   → tất cả của editor + xóa dữ liệu + quản lý thành viên + quản lý invitation
```

---

## Lưu ý

- Không có role `owner` riêng biệt — người tạo org tự động được add vào `org_members` với role `admin`.
- Không có permission cấp độ **global** — mọi quyền đều scoped theo `org_id`.
- `mcp_oauth_codes`, `mcp_oauth_tokens`, `mcp_oauth_clients` hiện **không có RLS policy** — truy cập qua server-side only.
