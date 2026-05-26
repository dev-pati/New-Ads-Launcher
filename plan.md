# Plan: Áp dụng kiến trúc AdManage.ai vào app

## Tóm tắt vấn đề hiện tại

| Vấn đề | Nguyên nhân |
|---|---|
| Rate limit leo lên 18-19% | Mỗi upload video → gọi ngay FB API, thumbnail polling aggressive |
| Upload fail khi rate limit cao | Finalize gọi `uploadVideoUrlToMeta` trong cùng request với user |
| 100 video bulk upload = rate limit spike | 100 FB API calls liên tiếp |
| Thumbnail polling tốn quota | MAX 3 concurrent, nhưng vẫn poll 6 lần × 30s mỗi video |

## Kiến trúc hiện tại (flow)

```
Browser → upload-sign → Supabase Storage
Browser → /api/creatives/finalize → uploadVideoUrlToMeta() → graph.facebook.com  ← TỐN QUOTA NGAY
Browser → poll /api/creatives/[id]/thumbnail × 6 lần/video  ← TỐN QUOTA THÊM
```

## Kiến trúc mục tiêu (học từ AdManage.ai)

```
Browser → upload-sign → Supabase Storage → DB (status: "pending")   ← TRẢ VỀ NGAY
                                            ↓
              Background Worker (Vercel Cron / Supabase Edge Function)
                                            ↓
                          graph.facebook.com (rate-limit controlled)
                                            ↓
                          DB update (status: "ready" | "error")
```

---

## 3 Hướng thay đổi (theo mức độ ưu tiên)

---

### Hướng 1 — Tách Facebook upload ra khỏi flow upload (ƯU TIÊN CAO NHẤT)

**Thay đổi gì:**
- `/api/creatives/finalize` KHÔNG gọi Facebook nữa khi upload
- Chỉ lưu vào DB với `status = "pending"` và `fb_video_id = null`
- Trả về ngay → user thấy file xuất hiện trong library ngay lập tức
- Background job định kỳ (mỗi 1 phút) scan DB tìm `status = "pending"` → upload lên FB → update DB

**Yêu cầu từ bạn:**
- [ ] Quyết định dùng background job nào: **Vercel Cron** (đơn giản, miễn phí) hay **Supabase Edge Function** (realtime hơn)
- [ ] Thêm column `fb_upload_queued_at` vào bảng `creatives` trong Supabase (hoặc mình tự migration)
- [ ] Xác nhận plan này không ảnh hưởng Launch page — Launch page hiện tại cần `fb_video_id` để tạo ad, nếu video chưa upload xong thì sẽ block launch

**Files thay đổi:**
- `app/api/creatives/finalize/route.ts` — bỏ FB call, chỉ insert DB
- `app/api/cron/upload-to-facebook/route.ts` — NEW: background worker
- `vercel.json` — thêm cron schedule
- `app/(dashboard)/assets/page.tsx` — cập nhật UI status badge "Pending → Processing → Ready"

**Lợi ích:**
- Upload 100 video → 0 FB call ngay lập tức
- Rate limit không tăng khi user upload
- Upload không bao giờ fail vì rate limit

---

### Hướng 2 — Server-side job queue với rate limit control

**Thay đổi gì:**
- Background worker từ Hướng 1, thêm logic:
  - Check `x-app-usage` trước mỗi batch
  - Nếu > 60%: dừng, retry sau 5 phút
  - Nếu 30–60%: upload 1 video/lần, delay 3s
  - Nếu < 30%: upload 3 video song song
- Queue stored trong Supabase bảng `fb_upload_queue`

**Yêu cầu từ bạn:**
- [ ] Tạo bảng `fb_upload_queue` trong Supabase (mình viết SQL migration)
- [ ] Xác nhận Vercel plan cho phép cron chạy mỗi 1 phút (Hobby plan: mỗi ngày, Pro plan: mỗi phút)

**Files thay đổi:**
- `app/api/cron/upload-to-facebook/route.ts` — thêm adaptive rate limiting logic
- `lib/upload-queue.ts` — NEW: queue management

---

### Hướng 3 — tRPC-style Batch API cho các calls hiện tại (QUICK WIN)

**Thay đổi gì:**
- Hiện tại Launch page gọi nhiều endpoints riêng lẻ (campaigns, adsets, ads, creatives...)
- Gom lại thành 1 endpoint `/api/batch` nhận array requests, trả về array responses
- Giảm số HTTP round-trips từ browser

**Yêu cầu từ bạn:**
- [ ] Không cần gì thêm, chỉ cần confirm muốn làm

---

## Timeline đề xuất

| Bước | Nội dung | Thời gian |
|---|---|---|
| 1 | Hướng 1: Tách FB upload → background job | 2–3 giờ |
| 2 | Hướng 2: Adaptive queue với rate control | 1–2 giờ |
| 3 | Hướng 3: Batch API | 1 giờ |

---

## Câu hỏi cần bạn trả lời trước khi bắt đầu

1. **Background job**: Dùng **Vercel Cron** (thêm vào `vercel.json`, gọi API route mỗi N phút) hay **Supabase Edge Function** (trigger theo DB event)?
   - Vercel Cron: đơn giản, không cần infra mới, Pro plan chạy được mỗi 1 phút
   - Supabase Edge Function: realtime hơn, trigger ngay khi insert vào DB

2. **Launch page behaviour khi video chưa ready**: Khi user chọn video đang `status=pending` để launch → block và hiện thông báo "Video đang upload lên Meta, vui lòng chờ" hay tự động trigger upload ngay lập tức (bỏ qua queue)?

3. **Vercel plan**: Bạn đang dùng plan nào? (Hobby không support cron mỗi phút, Pro thì được)

4. **DB migration**: Bạn tự thêm column/table vào Supabase hay muốn mình generate SQL migration script?

---

## Không thay đổi

- Flow upload client-side (sign → PUT to Supabase Storage) → giữ nguyên, đã tối ưu
- Token Facebook vẫn server-side → giữ nguyên, đã đúng
- Thumbnail polling với dedup + backoff → giữ nguyên (đã fix tuần trước)
- Image upload vẫn sync (ảnh nhỏ, nhanh, không ảnh hưởng quota nhiều)
