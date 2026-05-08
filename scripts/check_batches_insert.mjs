import { createClient } from "@supabase/supabase-js";
const sb = createClient("https://ihyxphomtajqoesdbsog.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloeXhwaG9tdGFqcW9lc2Ric29nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ0NDc4MCwiZXhwIjoyMDkzMDIwNzgwfQ.COdHbHJCar8eBu_r9bghTquZ5LWK5dghEgsdwF4RTlM");
const { data, error } = await sb.from("launch_batches").insert({
  org_id: "00000000-0000-0000-0000-000000000000",
  user_id: "00000000-0000-0000-0000-000000000000",
  ad_account_id: "test",
}).select("*");
console.log(error || data);
