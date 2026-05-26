# Access And Ownership Handover

Tai lieu nay dung de ban giao tai khoan, quyen truy cap va ownership cho cong ty. Khong ghi mat khau that, API key that hay secret that vao file nay.

## 1. Nguyen Tac Bat Buoc

Tat ca dich vu ben thu ba app dang dung phai dung ten cong ty hoac duoc chuyen quyen quan tri cho cong ty.

Khong de he thong phu thuoc vao:

- Email ca nhan cua nguoi ban giao.
- Tai khoan Meta/Facebook ca nhan khong co admin cong ty.
- Supabase project nam trong workspace ca nhan.
- Domain/DNS nam trong tai khoan ca nhan.
- API key chi nguoi ban giao biet.

Sau khi ban giao, cong ty phai doi/rotate lai toan bo secret quan trong.

## 2. Luu Y Bao Mat

Khong gui cac thong tin sau qua README, Google Docs public, Zalo, Slack/Teams chat thuong, email plain text hoac screenshot:

- Mat khau.
- Supabase service role key.
- Database URL co password.
- Meta app secret.
- Lark app secret.
- Google client secret.
- Resend API key.
- OpenAI/Gemini API key.
- CRON_SECRET.
- Cloudflare Access secret.
- Private SSH key.

Kenh ban giao an toan nen dung:

- Password manager cua cong ty: 1Password, Bitwarden, Dashlane, Keeper, LastPass Enterprise.
- Secret manager: Doppler, Infisical, AWS Secrets Manager, GCP Secret Manager, Vault.
- Buoi ban giao truc tiep, cong ty tu doi mat khau/rotate key ngay sau khi nhan.

## 3. Danh Sach Dich Vu Can Ban Giao

| Dich vu | Dung de lam gi | Quyen cong ty can nam |
|---|---|---|
| Git repository | Luu source code app | Owner/Admin repo, quyen merge/deploy. |
| Hosting/server app | Chay Next.js app/Docker container | Admin server/hosting, quyen restart/deploy/logs. |
| Mac Mini | Dang host Supabase/self-hosted services neu co | Quyen admin may, SSH, Docker, backup, physical access. |
| Supabase/Postgres | Database, Storage, PostgREST | Owner/Admin project, DB admin, service role rotation. |
| Supabase Storage `ad-media` | Luu anh/video creative | Quyen backup/restore storage volume/bucket. |
| Domain/DNS | Domain production, OAuth callback URL | Owner/Admin DNS, registrar, SSL/reverse proxy. |
| Lark Developer App | Dang nhap SSO/OAuth | App owner/admin, app secret rotation, callback config. |
| Meta/Facebook Developer App | Facebook OAuth, Marketing API | App admin, business verification/app review access. |
| Meta Business Manager | Ad accounts, pages, pixels, catalogs | Business admin, ad account/page/pixel/catalog admin. |
| Facebook Pages/Instagram profiles | Identity de launch ads | Admin/full control qua Business Manager. |
| Google Cloud OAuth | Google Drive/Sheets import | Project owner/admin, OAuth consent, client secret rotation. |
| Resend | Gui email invitation/transactional | Owner/admin, domain sender, API key rotation. |
| OpenAI | AI features | Org/project owner, API key rotation, billing access. |
| Gemini/Google AI | AI analysis/features | Project owner, API key rotation, billing/quota access. |
| Cloudflare Access | Bao ve Supabase/internal APIs neu co | Account admin, service token rotation. |
| Docker registry | Luu image neu co registry rieng | Admin registry/project. |
| Backup storage | Luu backup DB/storage ngoai Mac Mini | Admin bucket/folder/NAS, verify restore. |
| Email/domain sender | Domain gui email neu dung Resend | DNS admin, SPF/DKIM/DMARC control. |

## 4. Bien Moi Truong Lien Quan Den Access

Xem file mau:

```text
.env.example
```

Nhom secret cong ty can rotate sau ban giao:

```text
CUSTOM_AUTH_SECRET
JWT_SECRET
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL
LARK_APP_SECRET
FACEBOOK_APP_SECRET
GOOGLE_CLIENT_SECRET
RESEND_API_KEY
OPENAI_API_KEY
GEMINI_API_KEY
CF_ACCESS_CLIENT_SECRET
NEXT_PUBLIC_CF_ACCESS_CLIENT_SECRET
CRON_SECRET
CLOUD_DATABASE_URL
CLOUD_DB_PASSWORD
```

Luu y:

- `NEXT_PUBLIC_*` co the lo ra browser bundle, khong dat secret that vao do.
- `SUPABASE_SERVICE_ROLE_KEY` bypass RLS, phai xem nhu root key cua database API.
- `DATABASE_URL` co password database, phai quan ly nhu secret.

## 5. Checklist Ban Giao Ownership

Nguoi ban giao va cong ty nen di qua tung muc:

- [ ] Source code da nam trong Git org cua cong ty.
- [ ] Cong ty co it nhat 2 admin trong Git repo.
- [ ] Docker/hosting/server production thuoc tai khoan cong ty.
- [ ] Cong ty co SSH/admin access vao Mac Mini neu Mac Mini van chay DB.
- [ ] Supabase project/workspace thuoc cong ty.
- [ ] Cong ty co DB admin/postgres credentials.
- [ ] Backup DB da duoc cau hinh chay dinh ky.
- [ ] Backup duoc copy ra ngoai Mac Mini.
- [ ] Da test restore backup thanh cong tren DB test.
- [ ] Domain registrar/DNS thuoc tai khoan cong ty.
- [ ] SSL/reverse proxy do cong ty quan ly.
- [ ] Lark app owner/admin la tai khoan cong ty.
- [ ] Lark redirect URL dung domain production.
- [ ] Meta Developer App co admin la cong ty.
- [ ] Meta Business Manager co admin la cong ty.
- [ ] Ad accounts/pages/Instagram/pixels/catalogs nam trong Business Manager cong ty.
- [ ] Google Cloud project/OAuth client thuoc cong ty.
- [ ] Resend account/API/domain sender thuoc cong ty.
- [ ] OpenAI/Gemini billing/API projects thuoc cong ty.
- [ ] Cloudflare Access/DNS/service token thuoc cong ty neu co dung.
- [ ] Cong ty da nhan danh sach bien moi truong can cau hinh, khong kem secret trong tai lieu public.

## 6. Viec Can Lam Ngay Sau Ban Giao

Ngay sau khi cong ty nhan quyen:

1. Doi mat khau cac tai khoan quan trong.
2. Bat MFA/2FA cho tat ca admin accounts.
3. Tao admin backup cho it nhat 2 nguoi trong cong ty.
4. Rotate Supabase service role key neu co the.
5. Rotate database password va cap nhat `DATABASE_URL`.
6. Rotate `CUSTOM_AUTH_SECRET` neu chap nhan user phai login lai.
7. Rotate `CRON_SECRET`.
8. Rotate Meta app secret neu can.
9. Rotate Lark app secret neu can.
10. Rotate Google client secret.
11. Rotate Resend/OpenAI/Gemini API keys.
12. Kiem tra app login duoc, connect Meta duoc, upload asset duoc, launch/report khong loi.
13. Chay backup thu cong va test restore.

## 7. Mau Bang Ban Giao Khong Chua Secret

Dung bang nay de ghi owner va trang thai. Khong ghi mat khau/key vao cot ghi chu.

| Dich vu | URL/Console | Owner hien tai | Owner sau ban giao | Trang thai | Ghi chu khong chua secret |
|---|---|---|---|---|---|
| Git repo |  |  |  | Pending/Done |  |
| Hosting/server |  |  |  | Pending/Done |  |
| Mac Mini |  |  |  | Pending/Done |  |
| Supabase/Postgres |  |  |  | Pending/Done |  |
| Domain/DNS |  |  |  | Pending/Done |  |
| Lark Developer App |  |  |  | Pending/Done |  |
| Meta Developer App |  |  |  | Pending/Done |  |
| Meta Business Manager |  |  |  | Pending/Done |  |
| Google Cloud OAuth |  |  |  | Pending/Done |  |
| Resend |  |  |  | Pending/Done |  |
| OpenAI |  |  |  | Pending/Done |  |
| Gemini/Google AI |  |  |  | Pending/Done |  |
| Cloudflare |  |  |  | Pending/Done |  |
| Backup storage |  |  |  | Pending/Done |  |
