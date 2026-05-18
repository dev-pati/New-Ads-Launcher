# Insights — Nguồn dữ liệu thống kê

> Cập nhật: 2026-05-17  
> Meta Graph API version: **v25.0**

---

## Tổng quan

| Loại nguồn | Số views | Ghi chú |
|---|---|---|
| Meta Graph API (real-time) | 13 / 14 | Fetch mỗi khi load, cache in-memory |
| Supabase DB | 1 / 14 | Upload Stats — data tự app tạo ra |

**Không có bảng nào trong DB lưu số liệu analytics** (spend, impressions, CTR, ROAS, v.v.)  
Tất cả số liệu Meta đều mất khi restart server (cache in-memory, không persist).

---

## Chi tiết từng View

### 1. All Accounts
- **Route:** `GET /api/insights/statistics/all-accounts`
- **Meta endpoints:**
  - `/{accountPath}?fields=name`
  - `/{accountPath}/insights?fields=spend,impressions,inline_link_clicks,inline_link_click_ctr,cpm&date_preset={preset}`
  - `/{accountPath}/insights?fields=spend,impressions,inline_link_clicks&date_preset={preset}&time_increment=1&limit=90`
- **Trả về:** spend, impressions, clicks, CTR, CPM theo từng ad account + daily chart
- **Cache:** Không có

---

### 2. Spend (Campaign Breakdown)
- **Route:** `GET /api/insights/statistics/spend`
- **Meta endpoints:**
  - `/{accountPath}/insights?level=campaign&fields=campaign_id,campaign_name,objective,spend,impressions,inline_link_clicks,inline_link_click_ctr,actions,cost_per_action_type&date_preset={preset}&sort=spend_descending&limit=50`
  - `/{accountPath}/insights?level=adset&fields=campaign_id,adset_id,adset_name,spend,impressions,inline_link_clicks,actions&date_preset={preset}&limit=100`
  - `/{accountPath}/campaigns?fields=id,name,objective,effective_status&limit=100`
  - `/{accountPath}/insights?level=campaign&fields=campaign_id,campaign_name,spend&date_preset={preset}&time_increment=1&limit=90` (daily)
- **Trả về:** spend, impressions, clicks, CPA theo campaign + adset; daily chart top 5 campaigns
- **Cache:** Không có

---

### 3. Demographic
- **Route:** `GET /api/insights/statistics/demographic`
- **Meta endpoints:**
  - `/{insightsPath}/insights?breakdowns=gender&fields=spend,impressions,inline_link_clicks,actions,action_values,cpm&date_preset={preset}&limit=10`
  - `/{insightsPath}/insights?breakdowns=age&fields=spend,impressions,inline_link_clicks,actions,action_values,cpm&date_preset={preset}&limit=10`
  - `/{insightsPath}/insights?breakdowns=age,gender&fields=spend,impressions,inline_link_clicks,cpm&date_preset={preset}&limit=50`
  - `/{accountPath}/insights?level=campaign&breakdowns=age,gender&fields=campaign_id,campaign_name,spend,impressions&date_preset={preset}&limit=100`
- **Trả về:** spend, impressions, purchases, CPA theo độ tuổi và giới tính
- **Cache:** Không có

---

### 4. Country
- **Route:** `GET /api/insights/statistics/country`
- **Meta endpoints:**
  - `/{insightsPath}/insights?breakdowns=country&fields=spend,impressions,inline_link_clicks,actions,action_values&date_preset={preset}&sort=spend_descending&limit=200`
  - `/{accountPath}/insights?level=campaign&fields=campaign_id,campaign_name,spend&date_preset={preset}&limit=100`
- **Trả về:** spend, impressions, purchases, ROAS, CPA, CTR theo quốc gia
- **Cache:** Không có

---

### 5. Placements
- **Route:** `GET /api/insights/statistics/placements`
- **Meta endpoints:**
  - `/{accountPath}/insights?breakdowns=publisher_platform,platform_position&fields=spend,impressions,inline_link_clicks,actions,action_values,cpm&date_preset={preset}&sort=spend_descending&limit=100`
  - `/{accountPath}/insights?breakdowns=publisher_platform&fields=spend,impressions,inline_link_clicks,actions,action_values,cpm&date_preset={preset}&limit=20`
  - `/{accountPath}/insights?breakdowns=publisher_platform&fields=spend,impressions,inline_link_clicks&date_preset={preset}&time_increment=1&limit=200` (daily)
- **Trả về:** spend, CPM, CPA, CTR, purchases theo platform (Facebook / Instagram / Messenger / Audience Network) và vị trí
- **Cache:** Không có

---

### 6. Device
- **Route:** `GET /api/insights/statistics/device`
- **Meta endpoints:**
  - `/{accountPath}/insights?breakdowns=impression_device&fields=spend,impressions,inline_link_clicks,actions&date_preset={preset}&limit=100`
  - Same endpoint với `time_range={prevRange}` (so sánh kỳ trước)
  - `/{accountPath}/insights?breakdowns=impression_device&fields=spend,impressions&date_preset={preset}&time_increment=1&limit=500` (daily)
- **Trả về:** spend, impressions, purchases, CPA, CTR theo device (mobile/desktop/tablet/connected TV) + delta so kỳ trước
- **Cache:** Không có

---

### 7. Reach & Frequency
- **Route:** `GET /api/insights/statistics/reach`
- **Meta endpoints:**
  - `/{insightsPath}/insights?fields=reach,frequency,impressions,spend&date_preset={preset}&time_increment=monthly&limit=200`
  - `/{accountPath}/insights?level=campaign&fields=campaign_id,campaign_name,spend&date_preset={preset}&limit=100`
- **Trả về:** reach, frequency, impressions, spend theo tháng; cumulative reach
- **Cache:** Không có

---

### 8. Ad History
- **Route:** `GET /api/insights/statistics/ad-history`
- **Meta endpoints:**
  - `/{insightsPath}/insights?level=ad&fields=ad_id,ad_name,adset_name,campaign_name,spend,impressions,inline_link_clicks,inline_link_click_ctr,actions&date_preset={preset}&time_increment=monthly&sort=spend_descending&limit=200`
  - `/{accountPath}/insights?level=campaign&fields=campaign_id,campaign_name,spend&date_preset={preset}&limit=100`
  - `/?ids={adIds}&fields=creative{image_url,thumbnail_url,video_id,...},created_time`
  - `/?ids={videoIds}&fields=picture`
- **Trả về:** spend, impressions, clicks, CTR của từng ad theo tháng + thumbnail
- **Cache:** Không có

---

### 9. Creative Audit
- **Route:** `GET /api/insights/statistics/creative-audit`
- **Meta endpoints:**
  - `/{insightsPath}/insights?level=ad&fields=ad_id,ad_name,adset_name,campaign_name,spend,impressions,inline_link_clicks,actions,video_avg_time_watched_actions,video_p25_watched_actions,video_p50_watched_actions,video_p75_watched_actions,video_p100_watched_actions&date_preset={preset}&sort=spend_descending&limit=200`
  - `/{accountPath}/insights?level=campaign&...&limit=100`
  - `/?ids={adIds}&fields=creative{image_url,thumbnail_url,video_id,call_to_action_type,body,...},created_time`
  - `/?ids={videoIds}&fields=picture`
  - `/{insightsPath}/insights?level=ad&fields=ad_id,spend&time_increment=1&limit=500` (daily CTA spend)
- **Trả về:** hook rate, avg watch time, video completion (25/50/75/100%), CTA performance, format mix (Video/Image/Carousel), top copy
- **Cache:** Không có

---

### 10. Top Creatives / Reports (tất cả sections)
- **Route:** `GET /api/insights/report`
- **Meta endpoints:**
  - `/{accountPath}/insights?level=ad&fields=ad_id,ad_name,adset_name,campaign_name,spend,impressions,inline_link_clicks,inline_link_click_ctr,outbound_clicks,frequency,reach,cpm,actions,action_values,video_thruplay_watched_actions,video_p25/50/75/95/100_watched_actions,video_30_sec_watched_actions,video_avg_time_watched_actions,date_start,date_stop&date_preset={preset}&sort=spend_descending&limit=50`
  - Batch API: `{adId}?fields=id,name,created_time,effective_status,creative{...}`
  - Batch API: `{creativeId}?thumbnail_width=600&thumbnail_height=750&fields=thumbnail_url,image_url`
- **Trả về:** ~60 metrics mỗi ad: spend, ROAS, CTR, CPM, frequency, reach, video metrics, conversion metrics, engagement metrics + thumbnail
- **Cache:** ✅ **15 phút** — key: `insights:report:{orgId}:{adAccountId}:{datePreset}`
- **Sections dùng chung 1 cache:** Top Creatives, All Active Ads, Fatigued Ads, Landing Pages, Ads L90D

---

### 11. Breakdown Widget (Dashboard)
- **Route:** `GET /api/insights/breakdown`
- **Meta endpoints:**
  - `/{accountPath}/insights?fields=spend,impressions,inline_link_clicks,actions,action_values,cpm&breakdowns={publisher_platform|age|gender|impression_device}&date_preset={preset}&limit=50`
- **Trả về:** spend, purchases, ROAS, CTR, CPC, CPM theo dimension được chọn
- **Cache:** Không có

---

### 12. Metrics Daily (Dashboard MTD chart)
- **Route:** `GET /api/insights/metrics`
- **Meta endpoints:**
  - `/{accountPath}/insights?fields=spend,impressions,reach,inline_link_clicks,inline_link_click_ctr,cpm,actions,action_values,cost_per_action_type,frequency,date_start,date_stop&time_increment=1&limit=100&date_preset={preset}` (có pagination)
- **Trả về:** daily spend, impressions, reach, clicks, purchases, purchase value, leads
- **Cache:** Không có

---

### 13. Ads Insights (Ads Manager view)
- **Route:** `POST /api/facebook/ads-insights`
- **Meta endpoints:**
  - Batch API: `{adId}?fields=id,name,status,effective_status,insights.date_preset({preset}){spend,impressions,clicks,actions,cpc,cpm,ctr,reach}`
- **Trả về:** spend, impressions, clicks, CTR, CPC, CPM, reach, actions cho từng ad ID được truyền vào
- **Cache:** Không có

---

### 14. Upload Stats ⬅ DUY NHẤT lấy từ DB
- **Route:** `GET /api/insights/statistics/upload-stats`
- **Nguồn:** Supabase bảng `launch_batches`
- **Fields:** id, user_id, user_name, ad_account_id, ad_account_name, status, total_ads, failed_ads, duration_ms, created_at, creative_ids, cta
- **Trả về:** số batch đã launch, số ads, success rate, leaderboard theo user, monthly chart
- **Cache:** Không có (query DB trực tiếp)

---

## Caching hiện tại

| Route | Cache | TTL | Key |
|---|---|---|---|
| `/api/insights/report` | ✅ In-memory | 15 phút | `insights:report:{orgId}:{accountId}:{datePreset}` |
| `/api/facebook/ad-accounts` | ✅ In-memory | 15 phút | `fb:ad-accounts:{orgId}` |
| Tất cả routes còn lại | ❌ Không có | — | — |

> Cache lưu trong `globalThis.__adlauncherFacebookMetadataCache` (Map).  
> Restart server = mất toàn bộ cache.  
> Xem implementation: `app/api/facebook/_cache.ts`

---

## Rate Limit liên quan

- **App-level quota** (`X-App-Usage`): 200 calls/giờ/app token → error code 4
- **Ad-account quota** (`X-Business-Use-Case-Usage` type `ADS_MANAGEMENT`): per ad account → lỗi "too many calls to this ad-account"
- Khi bị rate limit: backoff 5 phút, trả stale data nếu có
- Monitor tại: `/rate-limit` page trong sidebar → Connect

---

## Không lưu DB — Rủi ro

1. Không có lịch sử số liệu (Meta chỉ cho query tối đa 37 tháng)
2. Mỗi user load = 1 request đến Meta (dù data giống hệt nhau)
3. Restart server = mất cache, toàn bộ user load lại cùng lúc → spike rate limit
4. Không thể query/aggregate nội bộ mà không cần internet

---

## Bảng DB hiện có (liên quan ads)

| Bảng | Lưu gì | Không lưu gì |
|---|---|---|
| `ad_accounts` | ID, name, currency, status | Spend, impressions, CTR |
| `ads` | Targeting, budget config, CTA, headline | Actual spend, results |
| `creatives` | File URL, FB image hash, video ID | View count, hook rate |
| `launch_batches` | Ai launch, khi nào, bao nhiêu ads | Performance sau launch |
| `campaigns` (không có) | — | Không theo dõi campaign performance |
