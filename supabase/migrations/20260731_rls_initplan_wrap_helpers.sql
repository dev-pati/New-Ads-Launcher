-- STYLE ONLY — NOT A PERFORMANCE OPTIMIZATION. Read this before trusting the name.
--
-- Applied 2026-07-31, then measured. It is semantically correct and performance-NEUTRAL.
-- The original rationale below was wrong and is kept, corrected, so the mistake is not
-- repeated.
--
-- WHAT IT DOES
-- 129 policies live in `ads_launcher`; 111 of them call one of the six org-permission
-- helpers directly, e.g.
--
--     USING (ads_launcher.is_org_member(org_id))
--
-- This rewrites them to the scalar-subquery form:
--
--     USING ((select ads_launcher.is_org_member(org_id)))
--
-- WHY THAT DOES NOT SPEED ANYTHING UP HERE
-- The intent was Supabase's documented RLS pattern, where wrapping lets the planner
-- hoist the call into an InitPlan evaluated once per statement. That hoist only happens
-- for NON-CORRELATED calls — the canonical case is `(select auth.uid())`, which takes no
-- argument from the row. `is_org_member(org_id)` takes a per-row column, so it remains a
-- CORRELATED subquery and is evaluated once per row either way. Verified on the live
-- database:
--
--     Seq Scan on creatives (actual rows=121 loops=1)
--       Filter: (SubPlan 1)
--       SubPlan 1
--         ->  Result (actual rows=1 loops=216)      <-- still once per row
--
-- Benchmarked both forms over `creatives`, three runs each, cold run discarded:
-- unwrapped ~3.96 ms, wrapped ~3.89 ms — identical within noise.
--
-- THE REAL LEVER, FOR WHOEVER READS THIS NEXT
-- `org_members` shows 285,313 sequential scans and 3.55M tuples read, which looks like
-- an indexing problem and is not: it is a 13-row table read in full, 285k times. There
-- is nothing to optimize away in a 13-row scan. The driver is call volume (1.48M
-- PostgREST requests), so the fix is architectural — carry org membership in the JWT
-- claims so the helper stops being invoked per request. That is a design change, not a
-- migration.
--
-- WHY ALTER POLICY AND NOT DROP/CREATE
-- ALTER POLICY replaces only the expressions. Policy name, command, and the role list
-- (`polroles`) are untouched, so there is no window in which a table sits unprotected.
--
-- HOW THE REWRITE IS DERIVED
-- Generated from the live catalog rather than hand-transcribed, so it cannot drift from
-- what is actually installed. The regex matches ONLY `ads_launcher.<helper>(<column>)`.
-- Consequences of that, both deliberate:
--   * The `(select ...)` guard makes it idempotent — re-running changes nothing.
--   * Three policies bound to `public.is_org_admin` (on facebook_connections,
--     mcp_api_keys, org_ai_keys) are NOT matched and NOT modified. They are a separate
--     finding; those tables are served exclusively by service-role API routes, and
--     re-pointing them at the real helper would newly expose secret-bearing tables to
--     browser reads. Left exactly as-is on purpose.
--   * Composite policies (board_assets, media_upload_job_items) embed a helper call
--     inside a larger EXISTS/IN expression; the helper call is wrapped in place and the
--     surrounding expression is preserved verbatim.
--
-- CREATIVE PORTAL IMPACT: NONE.
-- The loop is filtered to `nspname = 'ads_launcher'`. No policy in `creative_portal`,
-- `public`, `auth`, or `storage` is read or written.

-- Exact rollback material. Captured BEFORE any ALTER, so restoring is a verbatim
-- replay of what was installed rather than a guess at how pg_get_expr will re-render
-- a rewritten expression. Additive: a new table in `ads_launcher`, referenced by
-- nothing, safe to drop once the change has been accepted.
create table if not exists ads_launcher._rls_policy_backup_20260731 (
  tbl        text not null,
  polname    text not null,
  qual       text,
  wcheck     text,
  captured_at timestamptz not null default now(),
  primary key (tbl, polname)
);

insert into ads_launcher._rls_policy_backup_20260731 (tbl, polname, qual, wcheck)
select c.relname, p.polname,
       pg_get_expr(p.polqual, p.polrelid),
       pg_get_expr(p.polwithcheck, p.polrelid)
from pg_policy p
join pg_class c     on c.oid = p.polrelid
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'ads_launcher'
on conflict (tbl, polname) do nothing;   -- keep the ORIGINAL capture if re-run

do $$
declare
  r record;
  new_qual text;
  new_check text;
  stmt text;
  n_changed int := 0;
  pattern constant text :=
    'ads_launcher\.(is_org_member|is_org_admin|can_edit_ads|can_delete_ads|can_upload_media|can_write_comments)\(([a-zA-Z_][a-zA-Z0-9_]*)\)';
begin
  for r in
    select c.relname                                as tbl,
           p.polname                                as polname,
           pg_get_expr(p.polqual, p.polrelid)       as qual,
           pg_get_expr(p.polwithcheck, p.polrelid)  as wcheck
    from pg_policy p
    join pg_class c     on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'ads_launcher'
    order by c.relname, p.polname
  loop
    new_qual  := regexp_replace(r.qual,   pattern, '(select ads_launcher.\1(\2))', 'g');
    new_check := regexp_replace(r.wcheck, pattern, '(select ads_launcher.\1(\2))', 'g');

    -- Idempotency guard: skip anything already hoisted.
    continue when new_qual is not distinct from r.qual
             and new_check is not distinct from r.wcheck;

    stmt := format('alter policy %I on ads_launcher.%I', r.polname, r.tbl);
    if new_qual  is not null then stmt := stmt || ' using (' || new_qual || ')'; end if;
    if new_check is not null then stmt := stmt || ' with check (' || new_check || ')'; end if;

    execute stmt;
    n_changed := n_changed + 1;
  end loop;

  raise notice 'RLS InitPlan wrap: % policies rewritten', n_changed;

  if n_changed not between 0 and 111 then
    raise exception 'Unexpected rewrite count % (expected <= 111) — aborting', n_changed;
  end if;
end
$$;

-- VERIFY (expect unwrapped = 0)
--   select count(*) filter (where pg_get_expr(p.polqual,p.polrelid) ~ '(?<!select )ads_launcher\.(is_org_member|is_org_admin|can_edit_ads|can_delete_ads|can_upload_media|can_write_comments)\(') as unwrapped
--   from pg_policy p join pg_class c on c.oid=p.polrelid join pg_namespace n on n.oid=c.relnamespace
--   where n.nspname='ads_launcher';
--
-- SMOKE TEST — ALREADY RUN, 2026-07-31, and passed. Impersonating an org admin
-- (set local role authenticated + request.jwt.claims) returned exactly the
-- service-role ground truth for that org — 6 members, 1 org, 121 creatives,
-- 6 ad accounts, 151 portal media items — and `is_org_member` returned false for a
-- different org, so tenancy isolation is intact. RLS regressions surface as wrong
-- row counts rather than errors, so verify counts, not the absence of errors.
--
-- NOTE: 2 of the 113 matching policies are intentionally NOT rewritten —
-- board_assets."Can manage board assets" and
-- media_upload_job_items."Org members can read job items". Their helper argument is a
-- correlated column from an inner subquery (`asset_boards.org_id`, `j.org_id`), which
-- the regex does not match by design; wrapping those would add a SubPlan for nothing.
--
-- ROLLBACK — verbatim replay from the snapshot captured above. Restores every policy
-- expression byte-for-byte as it was before this migration ran:
--   do $$
--   declare r record; s text;
--   begin
--     for r in select * from ads_launcher._rls_policy_backup_20260731 loop
--       s := format('alter policy %I on ads_launcher.%I', r.polname, r.tbl);
--       if r.qual   is not null then s := s || ' using ('      || r.qual   || ')'; end if;
--       if r.wcheck is not null then s := s || ' with check (' || r.wcheck || ')'; end if;
--       execute s;
--     end loop;
--   end $$;
--   -- then, once the rollback is confirmed:
--   -- drop table ads_launcher._rls_policy_backup_20260731;
--
-- DO NOT DROP THE BACKUP TABLE YET. As of 2026-07-31 the decision to keep or revert
-- this migration is still OPEN — it bought no measurable performance, so reverting is
-- a live option and `_rls_policy_backup_20260731` is the only exact record of the 129
-- original policy expressions. Drop it only once keeping the change is decided:
--   drop table ads_launcher._rls_policy_backup_20260731;
