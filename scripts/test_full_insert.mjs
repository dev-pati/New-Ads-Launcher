import { createClient } from "@supabase/supabase-js";
const sb = createClient("https://ihyxphomtajqoesdbsog.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloeXhwaG9tdGFqcW9lc2Ric29nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ0NDc4MCwiZXhwIjoyMDkzMDIwNzgwfQ.COdHbHJCar8eBu_r9bghTquZ5LWK5dghEgsdwF4RTlM");

const { data, error } = await sb.from("launch_batches").insert({
  org_id: "00000000-0000-0000-0000-000000000000",
  user_id: "00000000-0000-0000-0000-000000000000",
  user_name: "Test User",
  ad_account_id: "act_12345",
  ad_account_name: "Test Account",
  adset_ids: ["adset_1"],
  adset_names: ["Adset 1"],
  creative_ids: ["creative_1"],
  creative_thumbs: ["https://example.com/thumb.jpg"],
  primary_text: null,
  headline: null,
  cta: null,
  web_link: "https://example.com",
  page_id: "page_1",
  status: "success",
  total_ads: 1,
  failed_ads: 0,
  duration_ms: 1000,
  errors: [],
}).select("*");
console.log(error || data);
