import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = path => readFileSync(join(process.cwd(), path), "utf8")

describe("Notification message contract — [Actor] + [Action] + [Object] + [Change] + [Time]", () => {
  it("never lets a secret-shaped field reach the message builder in the clear", () => {
    const message = read("lib/notifications/message.ts")

    assert.match(message, /SECRET_FIELD = \/token\|secret\|password\|proof\|api\[_-\]\?key\|access\[_-\]\?key\|cookie\|credential\/i/)
    // Both the diff path and the redact-after-the-fact path must consult it.
    assert.match(message, /displayValue[\s\S]*?SECRET_FIELD\.test\(field\)[\s\S]*?\[redacted\]/)
    assert.match(message, /redactChanges[\s\S]*?SECRET_FIELD\.test\(c\.field\)[\s\S]*?\[redacted\]/)
  })

  it("caps the spelled-out change list at two fields and names the rest", () => {
    const message = read("lib/notifications/message.ts")

    assert.match(message, /changes\.slice\(0, 2\)/)
    assert.match(message, /and \$\{rest\} more field/)
  })

  it("drops a field from the diff when the after-value equals the before-value", () => {
    const message = read("lib/notifications/message.ts")

    assert.match(message, /JSON\.stringify\(from \?\? null\) === JSON\.stringify\(to \?\? null\)\) continue/)
  })

  it("only diffs keys actually present in the after-snapshot, never the whole object", () => {
    const message = read("lib/notifications/message.ts")

    assert.match(message, /if \(!\(field in after\)\) continue/)
  })
})

describe("Notification emit contract — fan-out, dedupe, visibility, org isolation", () => {
  it("writes one activity_log row and fans out to N notification rows via a dedupe-safe upsert", () => {
    const emit = read("lib/notifications/emit.ts")

    assert.match(emit, /from\("activity_log"\)/)
    assert.match(emit, /onConflict: "user_id,dedupe_key"/)
    assert.match(emit, /ignoreDuplicates: true/)
  })

  it("never sends a notification to the actor who caused it", () => {
    const emit = read("lib/notifications/emit.ts")

    assert.match(emit, /!== input\.actorId|recipient !== actorId|filter\([^)]*actorId/)
  })

  it("rejects links that are not same-origin relative paths", () => {
    const emit = read("lib/notifications/emit.ts")

    assert.match(emit, /function safeLink/)
    assert.match(emit, /startsWith\("\/"\)/)
  })

  it("scopes recipients to org members filtered by role visibility, not the whole org unconditionally", () => {
    const emit = read("lib/notifications/emit.ts")

    assert.match(emit, /ROLE_VISIBILITY/)
    assert.match(emit, /orgId/)
  })

  it("degrades to the legacy notification shape instead of throwing when v2 columns are absent", () => {
    const emit = read("lib/notifications/emit.ts")

    assert.match(emit, /isSchemaGap/)
    assert.match(emit, /degraded: true/)
  })

  it("emitAndLog never throws — a notification failure must not fail the caller's request", () => {
    const emit = read("lib/notifications/emit.ts")
    const fn = emit.slice(emit.indexOf("export async function emitAndLog"), emit.indexOf("export async function emitAndLog") + 800)

    assert.match(fn, /catch/)
    assert.doesNotMatch(fn, /catch \(\w+\) \{\s*\}/) // must not silently swallow — expects a console/log call
    assert.match(fn, /console\.(error|warn)/)
  })
})

describe("Lost-update protection contract (optimistic concurrency)", () => {
  it("refuses to write when the caller's expected_version does not match the current row_version", () => {
    const occ = read("lib/optimistic-update.ts")

    assert.match(occ, /currentVersion !== expectedVersion/)
    assert.match(occ, /kind: "conflict"/)
  })

  it("closes the read-then-write race with a WHERE row_version guard on the UPDATE itself", () => {
    const occ = read("lib/optimistic-update.ts")

    assert.match(occ, /\.eq\("row_version", expectedVersion\)/)
  })

  it("reports the conflict with actor, changed fields, and old/new values instead of overwriting silently", () => {
    const occ = read("lib/optimistic-update.ts")

    assert.match(occ, /changedBy/)
    assert.match(occ, /conflictFields/)
    assert.match(occ, /overlappingFields/)
    assert.match(occ, /was updated by .* while you were editing\. Review the latest changes before saving\./)
  })

  it("is not last-write-wins by default — only degrades when versioning is genuinely unavailable, and says so", () => {
    const occ = read("lib/optimistic-update.ts")

    assert.match(occ, /degraded: !hasVersionColumn \|\| expectedVersion === null/)
  })

  it("increments row_version and stamps updated_by/updated_at only on a successful write", () => {
    const occ = read("lib/optimistic-update.ts")

    assert.match(occ, /stamped\.row_version = \(currentVersion \?\? 1\) \+ 1/)
    assert.match(occ, /stamped\.updated_by = actorId/)
  })
})

describe("Real-time delivery contract — no polling, no duplicate delivery", () => {
  it("subscribes to postgres_changes instead of polling on an interval", () => {
    const hook = read("hooks/use-notifications.ts")

    assert.match(hook, /postgres_changes/)
    assert.match(hook, /table: "notifications"/)
    assert.doesNotMatch(hook, /setInterval\(\s*(?:async\s*)?\(\)\s*=>\s*(?:fetchNotifications|fetch\()/)
  })

  it("authenticates the realtime socket with the app's own JWT, not anon", () => {
    const hook = read("hooks/use-notifications.ts")

    assert.match(hook, /supabase\.realtime\.setAuth\(token\)/)
  })

  it("filters the subscription by user_id so one recipient's tab never receives another org member's rows", () => {
    const hook = read("hooks/use-notifications.ts")

    assert.match(hook, /filter: `user_id=eq\.\$\{userId\}`/)
  })

  it("merges incoming rows by id, so a reconnect replay cannot duplicate a list entry", () => {
    const hook = read("hooks/use-notifications.ts")

    assert.match(hook, /findIndex\(n => n\.id === row\.id\)/)
  })

  it("keeps a safety refetch net independent of the socket, so a dead-but-SUBSCRIBED channel is not silently trusted", () => {
    const hook = read("hooks/use-notifications.ts")

    assert.match(hook, /SAFETY_REFETCH_MS = 60_000/)
    assert.match(hook, /window\.setInterval\(refreshSilently, SAFETY_REFETCH_MS\)/)
  })

  it("tears down its channel on unmount so multiple tabs don't accumulate open sockets", () => {
    const hook = read("hooks/use-notifications.ts")

    assert.match(hook, /removeChannel\(channel\)/)
  })
})

describe("Notifications API contract — org isolation and schema degradation", () => {
  it("filters GET by both org_id and the caller's own user_id, never user_id alone", () => {
    const route = read("app/api/notifications/route.ts")

    assert.match(route, /\.eq\("org_id", ctx\.orgId\)/)
    assert.match(route, /\.eq\("user_id", ctx\.user\.id\)/)
  })

  it("falls back from v2 to legacy columns on a schema gap and reports degraded rather than 500ing", () => {
    const route = read("app/api/notifications/route.ts")

    assert.match(route, /isSchemaGap/)
    assert.match(route, /degraded/)
  })

  it("mark-all-read is scoped to the caller's own org and unread rows, not every notification row", () => {
    const route = read("app/api/notifications/route.ts")

    assert.match(route, /markAll[\s\S]*?\.eq\("org_id", ctx\.orgId\)\.eq\("is_read", false\)/)
  })
})

describe("Notification bell relocation contract (Phase 2 — scoped to Notification only)", () => {
  it("removes the bell from the header and leaves only the collapse control there", () => {
    const sidebar = read("components/app-sidebar.tsx")
    const header = sidebar.slice(sidebar.indexOf("{/* Header */}"), sidebar.indexOf("{/* Main nav */}"))

    assert.doesNotMatch(header, /IconBell/)
    assert.match(header, /setCollapsed\(!collapsed\)/)
  })

  it("places the bell inside the footer, above the profile row, matching the nav icon size rhythm", () => {
    const sidebar = read("components/app-sidebar.tsx")
    const footer = sidebar.slice(sidebar.indexOf("{/* User footer */}"))

    assert.match(footer, /<IconBell className=\{cn\("size-\[18px\]"/)
    // The bell button must appear before the profile DropdownMenu in source order.
    const bellIdx = footer.indexOf("IconBell")
    const profileIdx = footer.indexOf("DropdownMenu open={userMenuOpen}")
    assert.ok(bellIdx > -1 && profileIdx > -1 && bellIdx < profileIdx)
  })

  it("shows an unread badge that is visible but not distracting, and degrades to a dot when collapsed", () => {
    const sidebar = read("components/app-sidebar.tsx")

    assert.match(sidebar, /unreadCount > 99 \? "99\+" : unreadCount/)
    assert.match(sidebar, /size-2 rounded-full bg-primary ring-2 ring-sidebar/)
  })

  it("has a tooltip and stays reachable when the sidebar is collapsed", () => {
    const sidebar = read("components/app-sidebar.tsx")
    const footer = sidebar.slice(sidebar.indexOf("{/* User footer */}"))

    const tooltipIdx = footer.indexOf("<Tooltip delayDuration={0}>")
    const bellIdx = footer.indexOf("IconBell")
    const tooltipContentIdx = footer.indexOf('<TooltipContent side="right"')
    assert.ok(tooltipIdx > -1 && bellIdx > tooltipIdx, "the bell button must sit inside a Tooltip")
    assert.ok(tooltipContentIdx > bellIdx, "TooltipContent must follow the bell so it labels it, not another control")
  })

  it("does not touch anything outside the notification row — nav sections and theme controls are untouched", () => {
    const sidebar = read("components/app-sidebar.tsx")

    assert.match(sidebar, /navSections\.map/)
    assert.match(sidebar, /cycleTheme/)
  })
})

describe("Notification panel contract (Phase 2)", () => {
  it("anchors to the bell button instead of a hardcoded fixed offset", () => {
    const dropdown = read("components/notifications-dropdown.tsx")

    assert.match(dropdown, /anchorRef: React\.RefObject<HTMLElement \| null>/)
    assert.doesNotMatch(dropdown, /fixed left-\[210px\] top-12/)
  })

  it("groups notifications into Today / Yesterday / Earlier buckets", () => {
    const dropdown = read("components/notifications-dropdown.tsx")

    assert.match(dropdown, /"Today"/)
    assert.match(dropdown, /"Yesterday"/)
    assert.match(dropdown, /"Earlier"/)
  })

  it("renders old → new field changes, capped, with the object's deep link wired to router.push", () => {
    const dropdown = read("components/notifications-dropdown.tsx")

    assert.match(dropdown, /n\.changes\.slice\(0, 2\)/)
    assert.match(dropdown, /router\.push\(n\.link\)/)
  })

  it("uses the shared icon map instead of a duplicate local one, so a new notification type only needs updating once", () => {
    const dropdown = read("components/notifications-dropdown.tsx")

    assert.match(dropdown, /import \{ FAILURE_TYPES, iconForType \} from "@\/lib\/notifications\/types"/)
    assert.doesNotMatch(dropdown, /inspo_saved/)
  })

  it("closes on outside click and Escape, but ignores clicks on its own anchor button", () => {
    const dropdown = read("components/notifications-dropdown.tsx")

    assert.match(dropdown, /anchorRef\.current\?\.contains\(target\)\) return/)
    assert.match(dropdown, /e\.key === "Escape"/)
  })
})
