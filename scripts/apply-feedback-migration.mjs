import pg from "pg";
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import { join } from "node:path";

config({ path: ".env.local" });

const dbUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
if (!dbUrl) {
  console.error("Error: Neither DATABASE_URL nor DIRECT_URL is set in environment");
  process.exit(1);
}

const { Client } = pg;
let client;

try {
  const url = new URL(dbUrl);
  client = new Client({
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.slice(1),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: url.hostname.includes("localhost") || url.hostname.includes("127.0.0.1")
      ? false
      : { rejectUnauthorized: false, servername: url.hostname },
  });
} catch (err) {
  console.error("Failed to parse DB URL:", err.message);
  process.exit(1);
}

try {
  await client.connect();

  const migrationPath = join("supabase", "migrations", "20260729_hub_outbox.sql");
  const sql = readFileSync(migrationPath, "utf8");

  // Execute migration
  await client.query(sql);

  // Verification queries
  const colCheck = await client.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = 'ads_launcher'
      AND table_name = 'feedback_events'
      AND column_name = 'hub_short_id';
  `);

  const tableCheck = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'ads_launcher'
      AND table_name = 'feedback_hub_outbox';
  `);

  if (colCheck.rowCount === 1 && tableCheck.rowCount === 1) {
    console.log("APPLIED: feedback_hub_outbox OK, hub_short_id OK");
    process.exit(0);
  } else {
    console.error("Verification failed: columns or tables not created correctly.");
    if (colCheck.rowCount !== 1) console.error("Missing column hub_short_id in feedback_events");
    if (tableCheck.rowCount !== 1) console.error("Missing table feedback_hub_outbox");
    process.exit(1);
  }
} catch (err) {
  console.error("Migration execution failed:", err.message);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
