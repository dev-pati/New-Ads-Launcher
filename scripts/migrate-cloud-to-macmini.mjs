/**
 * migrate-cloud-to-macmini.mjs
 * Copy toàn bộ dữ liệu từ Supabase cloud → Mac Mini self-hosted.
 * Chạy: node scripts/migrate-cloud-to-macmini.mjs
 */

const CLOUD_URL = "https://ihyxphomtajqoesdbsog.supabase.co";
const CLOUD_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloeXhwaG9tdGFqcW9lc2Ric29nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQ0NDc4MCwiZXhwIjoyMDkzMDIwNzgwfQ.COdHbHJCar8eBu_r9bghTquZ5LWK5dghEgsdwF4RTlM";

const MINI_URL = "http://100.94.220.128:8000";
const MINI_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhdGktcHJvZCIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3Nzg0MjUyNDEsImV4cCI6MjA5Mzc4NTI0MX0.K3MpSInA3LEiBUfL4ZMcrQR3_xalYKywgs_iZ9JPGTE";
const MINI_SCHEMA = "ads_launcher";

// Thứ tự insert đúng theo FK dependency
const TABLE_ORDER = [
  "profiles",
  "organizations",
  "org_members",
  "org_invitations",
  "facebook_connections",
  "business_managers",
  "pages",
  "ad_accounts",
  "page_links",
  "creatives",
  "ads",
  "ad_media",
  "user_settings",
  "ad_set_presets",
  "launch_batches",
  "scheduled_activations",
  "ad_copy_templates",
  "asset_boards",
  "board_assets",
  "creative_requests",
  "comments",
  "comment_automations",
  "automation_runs",
  "automations",
  "automation_executions",
  "automation_approvals",
  "budget_schedules",
  "mcp_oauth_clients",
  "mcp_api_keys",
  "mcp_oauth_codes",
  "mcp_oauth_tokens",
  "inspo_saved_ads",
  "org_ai_keys",
  "notifications",
  "naming_schemas",
  "inspo_boards",
  "inspo_board_saves",
];

const BATCH = 500;

// ── helpers ──────────────────────────────────────────────────────────────────

function cloudHeaders(extra = {}) {
  return {
    apikey: CLOUD_KEY,
    Authorization: `Bearer ${CLOUD_KEY}`,
    "Accept-Profile": "public",
    ...extra,
  };
}

function miniHeaders(extra = {}) {
  return {
    apikey: MINI_KEY,
    Authorization: `Bearer ${MINI_KEY}`,
    "Content-Type": "application/json",
    "Content-Profile": MINI_SCHEMA,
    "Accept-Profile": MINI_SCHEMA,
    Prefer: "resolution=merge-duplicates",
    ...extra,
  };
}

async function fetchAll(url, headers) {
  let rows = [];
  let offset = 0;
  while (true) {
    const res = await fetch(`${url}&offset=${offset}&limit=${BATCH}`, {
      headers: { ...headers, "Range-Unit": "items", Range: `${offset}-${offset + BATCH - 1}` },
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`GET ${url} → ${res.status}: ${txt}`);
    }
    const chunk = await res.json();
    if (!Array.isArray(chunk) || chunk.length === 0) break;
    rows = rows.concat(chunk);
    if (chunk.length < BATCH) break;
    offset += BATCH;
  }
  return rows;
}

async function upsertBatch(table, rows) {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const res = await fetch(`${MINI_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: miniHeaders(),
      body: JSON.stringify(slice),
    });
    if (!res.ok) {
      const txt = await res.text();
      const err = (() => { try { return JSON.parse(txt); } catch { return {}; } })();
      // FK violation → thử insert từng row, skip row lỗi
      if (res.status === 409 || (err.code && err.code.startsWith("23"))) {
        let skipped = 0;
        for (const row of slice) {
          const r = await fetch(`${MINI_URL}/rest/v1/${table}`, {
            method: "POST",
            headers: miniHeaders(),
            body: JSON.stringify([row]),
          });
          if (!r.ok) skipped++;
        }
        if (skipped > 0) console.log(`    ⚠  ${table}: bỏ ${skipped}/${slice.length} rows (invalid FK)`);
      } else {
        throw new Error(`POST ${table} → ${res.status}: ${txt}`);
      }
    }
  }
}

// ── Step 1: auth.users → accounts ────────────────────────────────────────────

async function migrateAccounts() {
  console.log("\n[1/2] Migrate auth.users → accounts ...");
  let page = 1;
  let total = 0;

  while (true) {
    const res = await fetch(
      `${CLOUD_URL}/auth/v1/admin/users?page=${page}&per_page=${BATCH}`,
      { headers: { apikey: CLOUD_KEY, Authorization: `Bearer ${CLOUD_KEY}` } }
    );
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`auth/admin/users → ${res.status}: ${txt}`);
    }
    const data = await res.json();
    const users = data.users ?? [];
    if (users.length === 0) break;

    const accounts = users.map((u) => ({
      id: u.id,
      email: u.email,
      encrypted_password: u.encrypted_password ?? null,
      full_name: u.user_metadata?.full_name ?? u.raw_user_meta_data?.full_name ?? null,
      avatar_url: u.user_metadata?.avatar_url ?? u.raw_user_meta_data?.avatar_url ?? null,
      raw_user_meta_data: u.raw_user_meta_data ?? {},
      email_confirmed_at: u.email_confirmed_at ?? null,
      last_sign_in_at: u.last_sign_in_at ?? null,
      created_at: u.created_at,
      updated_at: u.updated_at,
    }));

    await upsertBatch("accounts", accounts);
    total += users.length;
    console.log(`  → page ${page}: ${users.length} users (total: ${total})`);
    if (users.length < BATCH) break;
    page++;
  }

  console.log(`  ✓ accounts: ${total} rows`);
  return total;
}

// ── Step 2: public.* → ads_launcher.* ────────────────────────────────────────

async function migrateTable(table) {
  let rows;
  try {
    rows = await fetchAll(
      `${CLOUD_URL}/rest/v1/${table}?select=*`,
      cloudHeaders()
    );
  } catch (err) {
    // Table không tồn tại trên cloud → skip
    if (err.message.includes("404") || err.message.includes("relation")) {
      console.log(`  ⚠  ${table}: không tồn tại trên cloud, skip`);
      return 0;
    }
    throw err;
  }

  if (rows.length === 0) {
    console.log(`  –  ${table}: 0 rows`);
    return 0;
  }

  await upsertBatch(table, rows);
  console.log(`  ✓  ${table}: ${rows.length} rows`);
  return rows.length;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== MIGRATION: Supabase Cloud → Mac Mini ===");
  console.log(`Cloud : ${CLOUD_URL}`);
  console.log(`Mini  : ${MINI_URL} (schema: ${MINI_SCHEMA})`);

  // Kiểm tra kết nối
  const ping = await fetch(`${MINI_URL}/rest/v1/accounts?select=id&limit=1`, {
    headers: miniHeaders(),
  });
  if (!ping.ok) throw new Error(`Mac Mini không respond: ${ping.status}`);
  console.log("✓ Kết nối Mac Mini OK\n");

  const t0 = Date.now();

  // 1. Accounts
  const accountCount = await migrateAccounts();

  // 2. Tables theo thứ tự FK
  console.log("\n[2/2] Migrate public tables ...");
  const results = {};
  for (const table of TABLE_ORDER) {
    results[table] = await migrateTable(table);
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

  console.log("\n=== XONG ===");
  console.log(`accounts: ${accountCount}`);
  for (const [t, n] of Object.entries(results)) {
    if (n > 0) console.log(`${t}: ${n}`);
  }
  console.log(`\nTổng thời gian: ${elapsed}s`);
}

main().catch((err) => {
  console.error("\n❌ LỖI:", err.message);
  process.exit(1);
});
