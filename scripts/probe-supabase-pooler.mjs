import pg from "pg";

const { Client } = pg;
const password = process.env.CLOUD_DB_PASSWORD;
const ref = process.env.CLOUD_PROJECT_REF;
if (!password || !ref) throw new Error("CLOUD_DB_PASSWORD and CLOUD_PROJECT_REF required");

const regions = [
  "ap-southeast-1",
  "ap-southeast-2",
  "ap-northeast-1",
  "us-east-1",
  "us-west-1",
  "eu-west-1",
  "eu-central-1",
];

for (const region of regions) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const client = new Client({
    host,
    port: 6543,
    database: "postgres",
    user: `postgres.${ref}`,
    password,
    ssl: { rejectUnauthorized: false, servername: host },
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    const res = await client.query("select current_user as user");
    console.log(`OK ${host} ${JSON.stringify(res.rows[0])}`);
    await client.end();
    process.exit(0);
  } catch (err) {
    console.log(`FAIL ${host}: ${err.code || err.message}`);
    try { await client.end(); } catch {}
  }
}

process.exit(1);
