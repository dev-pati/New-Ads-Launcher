  Dóng gói & bàn giao — Web app nội bộ Pati



  | Gửi đến | Seth — Marketing Manager |
  | Người yêu cầu | Nguyễn Văn Thuận |
  | Ngày | 26 / 05 / 2026 |
  | Hạn hoàn thành |31 /05 / 2026 |
  1. Source code & Repository
  Account
  Tên Repo
  URL
  dev-pati
  New-Ads-Launcher
  https://github.com/dev-pati/New-Ads-Launcher.git
  Toàn bộ source code của dự án đã được bàn giao trên GitHub của công ty để phục vụ cho việc phát triển, bảo trì và vận hành lâu dài.
  Lưu ý
  -  Đảm bảo đã được cấp quyền truy cập repository trước khi làm việc. 
  -  Không push các file chứa thông tin nhạy cảm như .env, secret key hoặc token lên Git. 
  -  Trước khi chạy dự án, vui lòng đọc README.md và thư mục handover/ để nắm cấu trúc hệ thống và quy trình deploy.
  2. File hướng dẫn (README) 
  Nội dung này chỉ được hỗ trợ trong Lark Docs
  Dự án đã được bổ sung file README.md tại thư mục gốc nhằm hỗ trợ người mới có thể nhanh chóng cài đặt, chạy và bảo trì hệ thống.
  Nội dung chính bao gồm
  -  Giới thiệu tổng quan về hệ thống và chức năng chính 
  -  Yêu cầu môi trường để chạy project 
  -  Hướng dẫn cài đặt và khởi chạy dự án 
  -  Hướng dẫn build production 
  -  Hướng dẫn deploy và restart hệ thống 
  -  Cấu trúc thư mục source code 
  -  Các lưu ý khi phát triển và vận hành 
  Lưu ý
  Vui lòng đọc kỹ README.md trước khi thực hiện setup hoặc deploy để đảm bảo đúng quy trình và tránh thiếu cấu hình môi trường.
  3. Database (Supabase)
  Dự án dùng Supabase — là PostgreSQL (quan hệ, SQL).
  Cụ thể hơn:
  - Database engine: PostgreSQL (do Supabase host)
  - Auth: Supabase Auth (bảng accounts nằm trong schema auth)
  - Storage: Supabase Storage (bucket ad_media)
  - Realtime: có enable cho bảng notifications
  - RLS (Row Level Security): được dùng trên hầu hết bảng 
  Không dùng ORM — query trực tiếp qua Supabase JS client (@supabase/supabase-js).
  Dựng lại database từ đầu bằng một file SQL:
  Dự án bao gồm những bảng DB được liệt kê trong file dưới đây:
  Nội dung này chỉ được hỗ trợ trong Lark Docs
  Nếu cần dựng database trắng từ đầu, chạy file bootstrap duy nhất:
  Nội dung này chỉ được hỗ trợ trong Lark Docs
  File này bao gồm schema ads_launcher, tables, indexes, triggers, RLS policies, các bảng mới từ migration và Storage bucket ad-media. Không cần chạy thêm migration nếu file bootstrap đã được cập nhật theo repo hiện tại.
  File hướng dẫn Backup And Restore Database
  Nội dung này chỉ được hỗ trợ trong Lark Docs
  Lưu ý
  -  Nếu file bootstrap đã được cập nhật theo repo mới nhất thì không cần chạy thêm migration. 
  -  Khuyến nghị backup database định kỳ trước khi update production. 
  -  Đảm bảo cấu hình đúng quyền truy cập Supabase trước khi restore hoặc deploy hệ thống.
  4. Biến môi trường & cấu hình
  Nội dung này chỉ được hỗ trợ trong Lark Docs
  Dự án đã được bổ sung file .env.example nhằm hướng dẫn cấu hình môi trường cho quá trình development và deploy.
  Nội dung chính bao gồm
  -  Danh sách các biến môi trường cần thiết 
  -  Cấu hình kết nối database 
  -  Cấu hình API và third-party services 
  -  Cấu hình authentication và access token 
  -  Cấu hình cho môi trường local và production 
  Lưu ý
  -  Không commit file .env thật hoặc các thông tin nhạy cảm lên Git. 
  -  Khi setup dự án, vui lòng tạo file .env.local hoặc .env.production dựa trên .env.example. 
  -  Đảm bảo cập nhật đúng các key/token trước khi chạy hệ thống.
  5. Đóng gói để chạy (Docker)
  Nội dung này chỉ được hỗ trợ trong Lark Docs
  Nội dung này chỉ được hỗ trợ trong Lark Docs
  Nội dung này chỉ được hỗ trợ trong Lark Docs
  Dự án đã được cấu hình Docker nhằm hỗ trợ việc deploy và chạy hệ thống đồng nhất giữa các môi trường.
  Nội dung bao gồm
  - Dockerfile để build ứng dụng 
  - docker-compose.yml để quản lý service 
  -  Hướng dẫn build và khởi chạy container 
  -  Hướng dẫn kiểm tra logs và trạng thái hệ thống 
  Các lệnh cơ bản
  Build project:
  docker compose build
  Khởi chạy hệ thống:
  docker compose up -d
  Kiểm tra container:
  docker compose ps
  Xem logs:
  docker compose logs -f adlauncher
  Truy cập ứng dụng
  http://localhost:3000
  Lưu ý
  -  Cần cấu hình đầy đủ file .env trước khi chạy Docker. 
  -  Nếu container chưa chạy thành công thì logs có thể chưa hiển thị đầy đủ. 
  -  Khuyến nghị sử dụng Docker để đảm bảo môi trường chạy đồng nhất khi deploy hoặc bàn giao.

  6. Tài khoản & quyền truy cập
  STT
  Dịch vụ
  Tài khoản
  Mật khẩu
  Mô tả
  URL
  1
  Vercel
  thomas@patigroup.com
  Pati@12345678 (login qua GG)
  Deploy dự án
  Vecel
  2
  APP GG
  thomas@patigroup.com
  Pati@12345678 (login qua GG)
  Connect GG để upload creative
  GG API
  3
  Domain Claudeflare


  Quản lý domain, dùng bằng tài khoản Claudeflare của anh Quang.
  Em tạo được domain là dựa vào tài khoản mail của Phong được anh Quang add vào

  7. Hướng dẫn deploy (đưa app lên chạy thật)
  Nội dung này chỉ được hỗ trợ trong Lark Docs
  Dự án đã được bổ sung tài liệu MACMINI_DEPLOY.md nhằm hướng dẫn deploy và vận hành hệ thống trên Mac Mini của công ty.
  Nội dung chính bao gồm
  -  Các bước setup và deploy ứng dụng 
  -  Cấu hình biến môi trường production 
  -  Hướng dẫn chạy Docker và kiểm tra service 
  -  Health check và kiểm tra trạng thái hệ thống 
  -  Hướng dẫn xử lý các lỗi cơ bản khi app gặp sự cố 
  -  Hướng dẫn backup, restore và chạy SQL 
  Các biến môi trường quan trọng
  NEXT_PUBLIC_SUPABASE_URL=
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
  SUPABASE_SERVICE_ROLE_KEY=
  NEXT_PUBLIC_SUPABASE_DB_SCHEMA=
  DATABASE_URL=
  Lưu ý
  -  Chỉ cần cấu hình đúng file .env là hệ thống có thể hoạt động bình thường. 
  -  Sau khi Mac Mini mất điện hoặc khởi động lại, Supabase/database có thể cần khoảng 10–20 phút để hoạt động ổn định trở lại. 
  -  Khuyến nghị kiểm tra health check và logs sau mỗi lần deploy hoặc restart hệ thống. 
  8. Quy trình tạo Meta App cho AdLauncher
  Tài liệu này hướng dẫn cách tạo và cấu hình Meta App dùng cho hệ thống AdLauncher. Người mới có thể làm theo từng bước để tạo app, cấu hình quyền và gửi Meta App Review.
  1. Tạo app trên Facebook Developer
  1. Truy cập: developers.facebook.com
  2. Vào My Apps.
  3. Chọn Create App.
  4. Ở phần use case, chọn:
  5. Create & manage ads with Marketing API
  6. Nhập thông tin app:
    - App name: AdLauncher
    - Contact email: email công ty hoặc email phụ trách app
  7. Chọn Business Portfolio tương ứng.
  8. Bấm Create app để hoàn tất tạo app.
  2. Cấu hình thông tin cơ bản của app
  Vào App Settings → Basic, sau đó điền các thông tin sau:
  Nội dung này chỉ được hỗ trợ trong Lark Docs
  Sau khi điền xong, bấm Save changes.
  3. Cấu hình Facebook Login for Business
  Vào Use Cases → Customize, tìm phần Facebook Login for Business và cấu hình các URL sau:
  Valid OAuth Redirect URIs
  https://ads.patigroup.com/api/auth/facebook/callback
  Deauthorize Callback URL
  https://ads.patigroup.com/api/auth/facebook/deauthorize
  Data Deletion Request URL
  https://ads.patigroup.com/privacy-policy
  Sau khi điền xong, bấm Save changes.
  4. Thêm các permissions cần thiết
  Vào Use Cases → Customize → Permissions, sau đó add các quyền sau:
  catalog_management
  email
  pages_show_list
  business_management
  ads_read
  pages_read_engagement
  public_profile
  ads_management
  Marketing API Access Tier
  Các quyền này dùng để app có thể đọc Business, Page, tài khoản quảng cáo và thực hiện thao tác launch/manage ads.
  5. Cập nhật biến môi trường
  Sau khi tạo app, lấy App ID và App Secret trong phần App Settings → Basic.
  Cập nhật các biến môi trường sau:
  NEXT_PUBLIC_FACEBOOK_APP_ID=<APP_ID>
  FACEBOOK_APP_ID=<APP_ID>
  FACEBOOK_APP_SECRET=<APP_SECRET>
  Cần cập nhật ở cả 2 nơi:
  - Vercel Environment Variables
  - File .env.local ở local
  Sau khi update env trên Vercel, cần redeploy lại app để biến môi trường mới có hiệu lực.
  6. Test API trước khi submit App Review
  Trước khi gửi review, cần test các endpoint bằng Graph API Explorer để Meta ghi nhận app có sử dụng permissions thật.
  Các bước thực hiện:
  1. Vào Graph API Explorer.
  2. Chọn app: AdLauncher.
  3. Generate Access Token.
  4. Chọn đầy đủ các permissions cần test.
  5. Gọi thử từng endpoint bên dưới.
  me?fields=email,name
  Dùng để test quyền:
  email
  public_profile
  me/accounts?fields=id,name
  Dùng để test quyền:
  pages_show_list
  me/businesses?fields=id,name
  Dùng để test quyền:
  business_management
  /{page_id}?fields=fan_count,posts.limit(1)
  Dùng để test quyền:
  pages_read_engagement
  /act_{ad_account_id}/campaigns?fields=id,name,status
  Dùng để test quyền:
  ads_read
  ads_management
  Mỗi endpoint nên submit khoảng 3–5 lần, sau đó chờ khoảng 24 giờ để Meta cập nhật dữ liệu API test call.
  7. Submit Meta App Review
  Vào Use Cases → Customize → Request for App Review.
  Khi submit review, cần chuẩn bị đầy đủ các phần sau:
  7.1. Allowed Usage
  Điền mô tả mục đích sử dụng cho từng permission.
  Nội dung cần giải thích rõ:
  - Permission này dùng để làm gì.
  - App sử dụng permission ở màn hình/chức năng nào.
  - Vì sao permission đó cần thiết cho AdLauncher.
  7.2. Video Screencast
  Upload video quay màn hình thao tác thực tế trên app.
  Video nên thể hiện:
  - Login/connect Facebook.
  - Chọn Business/Page/Ad Account.
  - Xem campaign/ad data.
  - Launch hoặc manage ads.
  - Các màn hình có sử dụng permissions đã request.
  7.3. Data Handling
  Ở phần Data Handling, điền:
  Supabase Inc.
  IT solutions
  United States
  7.4. Reviewer Instructions
  Điền hướng dẫn cho reviewer, bao gồm:
  - URL app production.
  - Test account.
  - Các bước login.
  - Các bước connect Facebook.
  - Các bước kiểm tra từng feature liên quan đến permission.
  - Ghi chú nếu reviewer cần chọn Business/Page/Ad Account cụ thể.
  7.5. Kiểm tra trước khi submit
  Trước khi bấm submit, cần đảm bảo:
  - Đã cấu hình đủ OAuth Redirect URI.
  - Đã cập nhật Privacy Policy URL.
  - Đã test API calls trong Graph API Explorer.
  - Đã chuẩn bị video screencast.
  - Đã điền Allowed Usage cho từng permission.
  - Đã điền Reviewer Instructions rõ ràng.
  Sau khi kiểm tra xong, bấm Submit for Review.
  8. Sau khi App Review được approved
  Sau khi Meta approved permissions:
  1. Publish app để các tài khoản bên ngoài có thể connect.
  2. Setup Meta System User Token để thay thế personal token.
  3. Cập nhật token vào hệ thống AdLauncher.
  4. Bật lại cron job trong GitHub Actions.
  5. Test lại flow launch ads end-to-end.
  6. Kiểm tra app có thể chạy ads mà không phụ thuộc vào personal token.
  9. Automation System

  9.1. Tổng quan
  Hệ thống automation cho phép tự động hóa các tác vụ quản lý ads dựa trên trigger và action.

  Flow hoạt động:
  Trigger fires → execSteps() → Action 1 → Delay (optional) → Approval (optional) → Action 2 → ...

  9.2. Trigger types đã implement

  Meta:
  - performance_monitoring — so sánh metrics day-over-day / week-over-week
  - campaign_status_change — khi campaign đổi status (active/paused/with_issues)
  - ad_approved — khi ad được approve từ Meta review
  - spend_threshold — khi ads thỏa điều kiện metric (ROAS, CPA, Spend...)
  - best_performing_organic_post — top organic post theo engagement/reach
  - roas_threshold — khi ROAS giảm dưới ngưỡng
  - cpa_spike — khi CPA tăng quá ngưỡng

  Google Sheets:
  - sheets_cell_changed — khi giá trị cell thay đổi và match condition
  - sheets_new_row_launch — khi có row mới → tự động launch ad
  - sheets_new_row_catalog — khi có row mới → thêm vào catalog

  Google Drive:
  - drive_new_file_in_folder — khi có file mới trong folder
  - drive_new_folder_in_folder — khi có folder mới

  Media Library:
  - media_uploaded — ngay khi file upload xong (immediately) hoặc khi approved

  Scheduled:
  - schedule — chạy theo lịch: one-time / daily / weekly / monthly

  9.3. Action types đã implement

  Meta:
  - pause_ad / pause_campaign / pause_adset
  - enable_ad / enable_campaign / enable_adset
  - duplicate_ad / duplicate_adset / duplicate_campaign
  - change_budget (increase/decrease/set, %/$, daily/lifetime)
  - launch_ad (tạo ad mới từ creative trong trigger payload)
  - swap_creative / create_rule / toggle_rule / update_rule / apply_existing_rule
  - set_minimum_spend

  Google Sheets:
  - add_sheet_row / update_sheet_cell / update_sheet_row

  Media Library:
  - upload_to_media_library

  Notification:
  - send_notification (Email + Slack, custom message với variables)

  9.4. Delay & Approval steps

  Delay step:
  - Khi gặp delay step → lưu execution state vào DB (status=pending, resumeAt=timestamp)
  - Cron resume-pending-executions chạy để resume sau khi delay hết
  - Hỗ trợ: minutes / hours / days

  Approval step:
  - Khi gặp approval step → gửi email cho approvers với link approve/reject
  - Link: /api/automations/executions/[id]/approve?token=xxx
  - Link: /api/automations/executions/[id]/reject?token=xxx
  - Approval timeout: configurable (default 24h)
  - Sau khi approve → resumeAutomation() tiếp tục từ step tiếp theo

  9.5. Test mode (an toàn khi test)
  - Bấm nút "Run" trong WorkflowBuilder → is_test=true
  - Tất cả Meta API mutations (pause/enable/duplicate/budget/launch) bị SKIP
  - Chỉ log "[TEST] Would execute..." thay vì gọi API thật
  - Đảm bảo không ảnh hưởng đến real Meta ads khi test

  9.6. Cron jobs (GitHub Actions)

  File: .github/workflows/meta-triggers.yml

  | Job | Endpoint | Schedule |
  |-----|----------|----------|
  | check-meta-triggers | /api/cron/check-meta-triggers | Daily 9am UTC |
  | check-sheets-triggers | /api/cron/check-sheets-triggers | Daily 9am UTC |
  | check-drive-triggers | /api/cron/check-drive-triggers | Daily 9am UTC |
  | check-scheduled-triggers | /api/cron/check-scheduled-triggers | Daily 9am UTC |
  | resume-pending-executions | /api/cron/resume-pending-executions | Daily 9am UTC |
  | snapshot-metrics | /api/cron/snapshot-metrics | Daily 9am UTC |

  GitHub Secrets cần cấu hình:
  - CRON_SECRET — giá trị lấy từ env CRON_SECRET
  - APP_URL — https://ads.patigroup.com

  Lưu ý: Cron đang tắt (schedule commented out) do chờ Meta System User Token. Bật lại bằng cách uncomment 3 dòng schedule trong file workflow.

  10. Campaign Metrics Snapshots (Data Persistence)

  Mục tiêu: Giữ lại data ngay cả khi Meta account bị lock/ban.

  Bảng DB: campaign_insights_snapshots
  - Lưu metrics theo ngày: spend, impressions, clicks, purchases, ROAS, CPA, CTR, CPM
  - Upsert theo (org_id, fb_campaign_id, date)

  Migration cần chạy trên production:
  supabase/migrations/20260603_campaign_insights_snapshots.sql

  Cách sync data:
  1. Tự động: cron snapshot-metrics chạy hàng ngày
  2. Thủ công: POST /api/insights/sync-snapshots với body {"days": 30}

  Đọc data từ DB (không cần Meta API):
  GET /api/insights/snapshots?ad_account_id=act_xxx&days=30

  11. API Endpoints quan trọng

  | Endpoint | Method | Mô tả |
  |----------|--------|-------|
  | /api/meta/review-test | POST | Test tất cả Meta permissions cho App Review |
  | /api/insights/snapshots | GET | Đọc campaign metrics từ DB (offline) |
  | /api/insights/sync-snapshots | POST | Manual sync metrics từ Meta về DB |
  | /api/image-proxy | GET | Proxy Facebook CDN images (tránh 403) |
  | /api/automations/[id]/run | POST | Chạy automation thủ công |
  | /api/automations/executions/[id]/approve | GET | Approve automation step |
  | /api/automations/executions/[id]/reject | GET | Reject automation step |
  | /api/cron/check-meta-triggers | GET | Cron: check Meta triggers |

  12. Security đã implement

  - appsecret_proof: Tất cả Meta API calls có chữ ký HMAC-SHA256
  - Authorization header: Token trong header, không trong URL
  - User-Agent: Mọi request có identifier "AdLauncher/1.0"
  - Test mode isolation: is_test=true skip tất cả Meta mutations

  13. Meta System User Token (cần setup sau App Review)

  Lý do cần:
  - Personal token gắn với tài khoản cá nhân → có thể bị lock nếu Facebook phát hiện API calls từ server IP lạ
  - System User Token không gắn với người thật → không bao giờ bị lock

  Hướng dẫn tạo:
  1. Vào Meta Business Manager (business.facebook.com)
  2. Settings → Users → System Users
  3. Add System User → chọn role Admin
  4. Generate Token → chọn đủ permissions (ads_management, ads_read, business_management, pages_show_list, pages_read_engagement, catalog_management)
  5. Copy token → lưu vào env: FACEBOOK_SYSTEM_USER_TOKEN=xxx

  Cập nhật code:
  - lib/auth.ts: getFacebookConnection() ưu tiên FACEBOOK_SYSTEM_USER_TOKEN nếu có
  - Khi có System User Token → bật lại cron jobs trong GitHub Actions

  14. Các tính năng nên phát triển tiếp theo
  1. Hoàn thiện Launch Ad — ưu tiên cao nhất
  Hiện tại, tính năng Launch Ad mới hỗ trợ launch vào ad set có sẵn. Để app có thể vận hành end-to-end tốt hơn, cần bổ sung:
  - Tự tạo Campaign và Ad Set mới khi launch.
  - Hỗ trợ multi-placement cho nhiều format creative cùng lúc: 1:1, 9:16, 4:5.
  - Hiển thị ad preview trước khi launch.
  - Cho phép duplicate từ ad có sẵn và thay creative mới.
  2. Nâng cấp Notification Action
  Hiện tại hệ thống mới chỉ hỗ trợ gửi email đơn giản. Cần mở rộng thêm:
  - Tích hợp Slack webhook thực tế.
  - Gửi notification qua Telegram.
  - Thiết kế email template dạng HTML, có thumbnail creative.
  - Hoàn thiện in-app notification bell: hiện đã có icon nhưng chưa có logic xử lý.
  3. Bổ sung Conditions trong Automation
  Hiện tại automation đang chạy theo luồng đơn giản: trigger → action. Cần phát triển thêm logic điều kiện để automation linh hoạt hơn:
  - If/Else branch: ví dụ ROAS > 2 thì scale, ROAS < 1 thì pause.
  - Filter step: chỉ chạy automation với các ads thỏa điều kiện cụ thể.
  - Loop step: lặp action cho từng ad trong danh sách.
  4. Kết nối Inspo với Automation
  Cần kết nối dữ liệu từ Inspo/Ad Library với tính năng Launch để tối ưu workflow clone ads:
  - Lưu ad từ competitor và clone structure chỉ với 1 click.
  - Gợi ý copy dựa trên các top-performing ads.
  - Cho phép dùng creative/copy từ Inspo làm đầu vào cho Launch Ad.
  5. Tích hợp Naming Schema vào Launch
  Hiện tại Naming Schema đang là một feature riêng lẻ. Cần tích hợp trực tiếp vào Launch flow:
  - Launch page tự động apply naming rule.
  - Automation Launch Ad sử dụng naming schema.
  - Đảm bảo campaign/ad set/ad name được tạo đồng bộ theo rule đã cấu hình.
  6. Bulk Operations
  Cần bổ sung các thao tác hàng loạt để tiết kiệm thời gian vận hành ads:
  - Pause/Enable nhiều ads cùng lúc trong Ads Manager.
  - Bulk update budget cho nhiều ad sets.

  15. Migration DB lên Supabase Cloud (04/06/2026)

  Bối cảnh:
  - Trước đây app dùng Supabase self-hosted trên MacMini (supabase.patiagency.com)
  - Đã chuyển sang Supabase cloud (project của PATI Group) để ổn định hơn và không phụ thuộc MacMini

  Thông tin cloud DB:
  - Project URL: https://vrnstjkxumaaduqswkji.supabase.co
  - Schema: ads_launcher (cần expose trong Project Settings → API → Exposed schemas)
  - Backup config MacMini: .env.local.macmini (tại root project)

  Các bước đã thực hiện:
  1. Tạo file cloud_setup.sql (supabase/cloud_setup.sql) — schema đầy đủ 42 bảng cho fresh install
  2. Chạy cloud_setup.sql trên Supabase Dashboard → SQL Editor
  3. Backfill data từ MacMini sang cloud qua pg_dump + psql (Session Pooler vì cloud chỉ có IPv6)
  4. Cập nhật .env.local với 3 keys mới: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY
  5. Expose schema ads_launcher: Dashboard → Project Settings → API → Data API → Exposed schemas → thêm ads_launcher
  6. Grant permissions: chạy SQL sau trong SQL Editor:
     GRANT USAGE ON SCHEMA ads_launcher TO anon, authenticated, service_role;
     GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA ads_launcher TO anon, authenticated, service_role;
     GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ads_launcher TO anon, authenticated, service_role;

  Migrations mới cần chạy (chưa có trong cloud_setup.sql):
  - supabase/migrations/20260603_campaign_insights_snapshots.sql
  - supabase/migrations/20260604_insights_snapshots_extended.sql
  - supabase/migrations/20260604_adset_snapshots.sql
  - supabase/migrations/20260604_snapshot_extended_metrics.sql

  Rollback về MacMini (nếu cần):
  cp .env.local.macmini .env.local && npm run dev

  16. Hệ thống Snapshot Metrics — Data Offline khi Meta bị block

  Mục tiêu: Sếp/nhân viên vẫn xem được số liệu ngay cả khi tài khoản Facebook bị khóa, bị ban, hoặc mất kết nối.

  Cơ chế hoạt động:
  1. Auto-save: Mỗi giờ khi user vào app → tự động snapshot tất cả ad accounts vào DB (fire-and-forget, không ảnh hưởng UI)
  2. Auto-fallback: Khi Meta API lỗi → tự động đọc từ DB, hiện banner vàng "Đang hiển thị dữ liệu đã lưu"
  3. Connection banner: Mọi trang trong app hiện banner đỏ/vàng khi tài khoản Facebook gặp sự cố

  Các bảng snapshot:

  | Bảng | Dữ liệu | Unique key |
  |------|---------|------------|
  | campaign_insights_snapshots | Metrics theo campaign theo ngày | (org_id, fb_campaign_id, date) |
  | adset_insights_snapshots | Metrics theo adset theo ngày | (org_id, fb_adset_id, date) |
  | ad_insights_snapshots | Metrics theo ad theo ngày (67 metrics) | (org_id, fb_ad_id, date) |
  | insights_breakdown_snapshots | Age/gender/country/device breakdown | (org_id, account, date_range, type, value) |
  | page_insights_snapshots | Facebook Page metrics theo ngày | (org_id, fb_page_id, date) |
  | ad_account_metrics_snapshots | Spend cap, balance, remaining | (org_id, fb_ad_account_id, synced_at) |

  Endpoints liên quan:
  - POST /api/insights/trigger-snapshot — trigger snapshot tất cả accounts (gọi từ layout tự động)
  - POST /api/insights/sync-snapshots — manual sync với tham số days (mặc định 7, tối đa 90)
  - GET /api/insights/page-insights?pageId=xxx&days=30 — Page Insights với fallback
  - GET /api/meta/connection-status — kiểm tra trạng thái kết nối Facebook

  Các trang Insights có fallback DB:
  - Dashboard metrics, Top Creatives, Spend, Demographic, Country, Device, Reach, Pacing, All Accounts, Page Insights

  Lưu ý quan trọng:
  - Snapshots chỉ có data sau lần đầu tiên user vào app thành công (Meta còn hoạt động)
  - DB hiện tại trống → cần vào app 1 lần khi Facebook hoạt động để data được lưu
  - Sau khi có data, kể cả bị block vẫn xem được số liệu đến ngày snapshot cuối cùng
  - Bulk duplicate ads/ad sets/campaigns.