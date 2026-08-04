import { NextResponse } from "next/server"
import { getAuthContext } from "@/lib/auth"

const MUTATION_ROLES = new Set(["admin", "editor", "launcher"])

export async function GET() {
  const ctx = await getAuthContext()
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  // Workspace v2 is now public to every org member.
  const enabled = true

  return NextResponse.json({
    enabled,
    canMutate: enabled && MUTATION_ROLES.has(ctx.role),
    role: ctx.role,
  })
}
