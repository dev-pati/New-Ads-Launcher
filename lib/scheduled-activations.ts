import { createAdminClient } from "@/lib/supabase/admin"

type CreateScheduledActivationInput = {
  orgId: string
  adAccountId: string
  adIds: string[]
  scheduledAt?: string | null
  endTime?: string | null
}

export async function createScheduledActivation(input: CreateScheduledActivationInput) {
  const adIds = input.adIds.filter(Boolean)
  if (!input.scheduledAt || adIds.length === 0) return null

  const { data, error } = await createAdminClient()
    .from("scheduled_activations")
    .insert({
      org_id: input.orgId,
      ad_account_id: input.adAccountId,
      ad_ids: adIds,
      scheduled_at: input.scheduledAt,
      end_time: input.endTime || null,
      status: "pending",
    })
    .select("id")
    .single()

  if (error) throw error
  return data
}
