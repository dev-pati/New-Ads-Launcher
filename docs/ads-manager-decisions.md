# Ads Manager Remake — Decision Log (2026-07-17)

Các câu hỏi user đưa ra và hướng giải quyết đã approve.

| # | Vấn đề | Quyết định |
|---|--------|-----------|
| 1 | Placement per platform hiển thị impression + result sai | X = tất cả placement detect được (both device), 2 metric bars/placement, bỏ cap top-10 |
| 2 | Video performance | Xem video live (iframe embed) + chart X = giây, Y = % video plays |
| 3 | Sidebar action menu — action chưa có flow | UI-only stubs: hiện đủ menu như Meta, action chưa có handler → disabled |
| 4 | Attribution settings vị trí | Dời khỏi chart popup → dropdown trên toolbar cột data (cạnh Columns) |
| 5 | Cột Attribution setting null | Fetch `attribution_spec` vào getAdSets/getAds; formatter normalize CLICK_THROUGH/VIEW_THROUGH |
| 6 | Attribution cho campaign | Campaign không có spec → align theo ad set con (join unique labels) |
| 7 | Phân loại attribution đặc biệt | Rỗng → "All conversions"; incremental → "Incremental attribution" |
| 8 | Daily budget trống | Có budget → số + note "Daily"; không có → "Using ad set budget" |
| 9 | Thứ tự cột | Delivery lên đầu tiên; bump localStorage key v2→v3 refresh state |
| 10 | Shopify score | Meta API không trả → gỡ khỏi preset ECOM (cần BE integration riêng) |
| 11 | Cột Results sub-fields | Stack: Total + Per Action + rate %; video → Average watch time |
| 12 | Footer totals | Tính mọi cột bật: Total / Average / Per Action / Per 1,000 Impressions / Per Meta account; bỏ total daily budget |
