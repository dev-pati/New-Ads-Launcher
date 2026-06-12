type SupabaseLike = {
  from: (table: string) => any
}

export type MessengerMessageInsert = {
  org_id: string
  conversation_id: string
  page_id: string
  customer_psid: string
  fb_message_id?: string | null
  direction: "inbound" | "outbound"
  message_type: "text" | "postback" | "attachment" | "unknown"
  message?: string | null
  attachments?: unknown[]
  raw_event?: unknown
  fb_created_time?: string | null
}

export async function messengerMessageExists(
  supabase: SupabaseLike,
  orgId: string,
  fbMessageId?: string | null
) {
  if (!fbMessageId) return false

  const { data, error } = await supabase
    .from("page_messages")
    .select("id")
    .eq("org_id", orgId)
    .eq("fb_message_id", fbMessageId)
    .maybeSingle()

  if (error) {
    console.error("[messenger-storage] duplicate check failed", error)
    return false
  }

  return Boolean(data?.id)
}

export async function insertMessengerMessage(
  supabase: SupabaseLike,
  row: MessengerMessageInsert
) {
  if (row.fb_message_id && await messengerMessageExists(supabase, row.org_id, row.fb_message_id)) {
    return { inserted: false, duplicate: true, error: null as any }
  }

  const { error } = await supabase.from("page_messages").insert(row)
  if (error) {
    const duplicate = error.code === "23505" || /duplicate key/i.test(error.message || "")
    if (!duplicate) console.error("[messenger-storage] insert failed", error)
    return { inserted: false, duplicate, error }
  }

  return { inserted: true, duplicate: false, error: null as any }
}

export async function insertMessengerMessages(
  supabase: SupabaseLike,
  rows: MessengerMessageInsert[]
) {
  const withFbId = rows.filter(row => row.fb_message_id)
  const withoutFbId = rows.filter(row => !row.fb_message_id)
  const existing = new Set<string>()

  if (withFbId.length) {
    const ids = Array.from(new Set(withFbId.map(row => String(row.fb_message_id))))
    const { data, error } = await supabase
      .from("page_messages")
      .select("fb_message_id")
      .eq("org_id", withFbId[0].org_id)
      .in("fb_message_id", ids)

    if (!error) {
      for (const row of data || []) {
        if (row.fb_message_id) existing.add(String(row.fb_message_id))
      }
    } else {
      console.error("[messenger-storage] batch duplicate check failed", error)
    }
  }

  const newRows = [
    ...withFbId.filter(row => row.fb_message_id && !existing.has(String(row.fb_message_id))),
    ...withoutFbId,
  ]

  if (!newRows.length) return { inserted: 0, error: null as any }

  const { error } = await supabase.from("page_messages").insert(newRows)
  if (error) {
    if (error.code === "23505" || /duplicate key/i.test(error.message || "")) {
      return { inserted: 0, error: null as any }
    }
    console.error("[messenger-storage] batch insert failed", error)
    return { inserted: 0, error }
  }

  return { inserted: newRows.length, error: null as any }
}
