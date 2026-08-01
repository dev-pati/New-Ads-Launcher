import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"

const MUTATION_ROLES = new Set(["admin", "editor", "launcher"])
const DEFAULT_CANARY_USERS = [
  "raymond.nguyen1707@gmail.com",
  "seth@patigroup.com",
]

function isEnabled() {
  const value = process.env.ADS_MANAGER_WORKSPACE_V2?.trim().toLowerCase()
  if (value === "1" || value === "true" || value === "on") return true
  if (value === "0" || value === "false" || value === "off") return false
  return process.env.NODE_ENV !== "production"
}

function canaryUsers() {
  const configured = process.env.ADS_MANAGER_WORKSPACE_V2_USERS
    ?.split(",")
    .map(value => value.trim().toLowerCase())
    .filter(Boolean)

  return new Set(configured?.length ? configured : DEFAULT_CANARY_USERS)
}

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const email = String(ctx.user.email || "").toLowerCase()
  const enabled = isEnabled() && canaryUsers().has(email)

  return NextResponse.json({
    enabled,
    canMutate: enabled && MUTATION_ROLES.has(ctx.role),
    role: ctx.role,
  })
}
