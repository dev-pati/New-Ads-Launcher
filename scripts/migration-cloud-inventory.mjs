import pg from "pg";

const { Client } = pg;

const cloudUrl = process.env.CLOUD_DATABASE_URL;
if (!cloudUrl) {
  throw new Error("CLOUD_DATABASE_URL is required");
}

const url = new URL(cloudUrl);
const client = new Client({
  host: process.env.CLOUD_DB_HOSTADDR || url.hostname,
  port: Number(url.port || 5432),
  database: url.pathname.slice(1),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
  ssl: { rejectUnauthorized: false, servername: url.hostname },
});

await client.connect();

async function q(sql, params = []) {
  const res = await client.query(sql, params);
  return res.rows;
}

console.log("== connection ==");
console.log(await q("select current_database() as db, current_user as user, inet_server_addr()::text as addr"));

console.log("== auth.users columns needed ==");
console.log(
  await q(`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'auth'
      and table_name = 'users'
      and column_name in (
        'id','email','encrypted_password','raw_user_meta_data',
        'created_at','updated_at','last_sign_in_at','email_confirmed_at',
        'confirmation_sent_at','confirmed_at'
      )
    order by ordinal_position
  `)
);

console.log("== auth users count/hash availability ==");
console.log(
  await q(`
    select
      count(*)::int as users,
      count(encrypted_password)::int as password_hashes,
      count(*) filter (where encrypted_password is null or encrypted_password = '')::int as missing_hash
    from auth.users
  `)
);

console.log("== public tables ==");
const tables = await q(`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_type = 'BASE TABLE'
  order by table_name
`);
console.log(tables.map((r) => r.table_name));

console.log("== public row counts ==");
for (const { table_name } of tables) {
  const ident = `"${table_name.replaceAll('"', '""')}"`;
  const [{ count }] = await q(`select count(*)::int as count from public.${ident}`);
  console.log(`${table_name}|${count}`);
}

console.log("== storage buckets ==");
try {
  console.log(await q("select id, public, file_size_limit, allowed_mime_types from storage.buckets order by id"));
  console.log(await q("select bucket_id, count(*)::int as objects from storage.objects group by bucket_id order by bucket_id"));
} catch (err) {
  console.log({ storage_error: err.message });
}

await client.end();
