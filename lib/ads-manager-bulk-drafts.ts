export type BulkDraftLevel = "campaign" | "adset" | "ad"
export type BulkDraftField = "turn_on" | "turn_off" | "budget" | "name"

export type BulkDraftNode = {
  id: string
  name?: string
  status?: string
  campaign_id?: string
  adset_id?: string
  daily_budget?: string
  lifetime_budget?: string
}

export type BulkEditableItem = {
  id: string
  name: string
  status: string
  campaign_id?: string
  adset_id?: string
  daily_budget?: string
  lifetime_budget?: string
  budgetEligible: boolean
  budgetBlockedReason?: string
}

export type BulkEditDraft = {
  key: string
  level: BulkDraftLevel
  id: string
  name: string
  original: BulkDraftNode
  node: BulkDraftNode
  updatedAt: string
}

export type BulkDraftMap = Record<string, BulkEditDraft>

export type BulkPublishResult = {
  id: string
  level: BulkDraftLevel
  status: "published" | "failed" | "skipped"
  message?: string
}

export const bulkDraftKey = (level: BulkDraftLevel, id: string) => `${level}:${id}`

function baseDraft(
  current: BulkEditDraft | undefined,
  level: BulkDraftLevel,
  item: BulkEditableItem,
): BulkEditDraft {
  if (current) return { ...current, node: { ...current.node }, updatedAt: new Date().toISOString() }
  return {
    key: bulkDraftKey(level, item.id),
    level,
    id: item.id,
    name: item.name,
    original: {
      id: item.id,
      name: item.name,
      status: item.status,
      campaign_id: item.campaign_id,
      adset_id: item.adset_id,
      daily_budget: item.daily_budget,
      lifetime_budget: item.lifetime_budget,
    },
    node: {
      id: item.id,
      name: item.name,
      campaign_id: item.campaign_id,
      adset_id: item.adset_id,
    },
    updatedAt: new Date().toISOString(),
  }
}

function pruneNoop(draft: BulkEditDraft): BulkEditDraft | null {
  const node = { ...draft.node }
  if (node.name === draft.original.name) delete node.name
  if (node.status === draft.original.status) delete node.status
  if (node.daily_budget === draft.original.daily_budget) delete node.daily_budget
  if (node.lifetime_budget === draft.original.lifetime_budget) delete node.lifetime_budget
  const changed = node.name !== undefined
    || node.status !== undefined
    || node.daily_budget !== undefined
    || node.lifetime_budget !== undefined
  return changed ? { ...draft, node } : null
}

export function stageNameDrafts(
  current: BulkDraftMap,
  level: BulkDraftLevel,
  items: BulkEditableItem[],
  name: string,
): BulkDraftMap {
  const normalized = name.trim()
  if (!normalized) throw new Error("Name is required")
  const next = { ...current }
  for (const item of items) {
    const key = bulkDraftKey(level, item.id)
    const draft = baseDraft(next[key], level, item)
    draft.node.name = normalized
    const pruned = pruneNoop(draft)
    if (pruned) next[key] = pruned
    else delete next[key]
  }
  return next
}

export function stageStatusDrafts(
  current: BulkDraftMap,
  level: BulkDraftLevel,
  items: BulkEditableItem[],
  status: "ACTIVE" | "PAUSED",
): BulkDraftMap {
  const next = { ...current }
  for (const item of items) {
    const key = bulkDraftKey(level, item.id)
    const draft = baseDraft(next[key], level, item)
    draft.node.status = status
    const pruned = pruneNoop(draft)
    if (pruned) next[key] = pruned
    else delete next[key]
  }
  return next
}

export function stageBudgetDrafts(
  current: BulkDraftMap,
  level: "adset",
  items: BulkEditableItem[],
  amountMajor: number,
): BulkDraftMap {
  if (!Number.isFinite(amountMajor) || amountMajor <= 0) throw new Error("Budget must be greater than 0")
  const minor = String(Math.round(amountMajor * 100))
  const next = { ...current }
  for (const item of items.filter(candidate => candidate.budgetEligible)) {
    const key = bulkDraftKey(level, item.id)
    const draft = baseDraft(next[key], level, item)
    if (item.daily_budget !== undefined) draft.node.daily_budget = minor
    else if (item.lifetime_budget !== undefined) draft.node.lifetime_budget = minor
    else continue
    const pruned = pruneNoop(draft)
    if (pruned) next[key] = pruned
    else delete next[key]
  }
  return next
}

export function draftChangeLabels(draft: BulkEditDraft): string[] {
  const labels: string[] = []
  if (draft.node.name !== undefined) labels.push(`Name: ${draft.node.name}`)
  if (draft.node.status !== undefined) {
    labels.push(draft.node.status === "ACTIVE" ? "Turn on" : "Turn off")
  }
  if (draft.node.daily_budget !== undefined) {
    labels.push(`Daily budget: $${(Number(draft.node.daily_budget) / 100).toFixed(2)}`)
  }
  if (draft.node.lifetime_budget !== undefined) {
    labels.push(`Lifetime budget: $${(Number(draft.node.lifetime_budget) / 100).toFixed(2)}`)
  }
  return labels
}

export function orderedDrafts(drafts: BulkEditDraft[]): BulkEditDraft[] {
  const order: Record<BulkDraftLevel, number> = { campaign: 0, adset: 1, ad: 2 }
  return [...drafts].sort((a, b) => order[a.level] - order[b.level] || a.name.localeCompare(b.name))
}

export function removePublishedDrafts(
  current: BulkDraftMap,
  results: BulkPublishResult[],
): BulkDraftMap {
  const published = new Set(
    results
      .filter(result => result.status === "published")
      .map(result => bulkDraftKey(result.level, result.id)),
  )
  return Object.fromEntries(Object.entries(current).filter(([key]) => !published.has(key)))
}

export function serializeBulkDrafts(drafts: BulkDraftMap): string {
  return JSON.stringify(drafts)
}

export function parseBulkDrafts(value: string | null): BulkDraftMap {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    return Object.fromEntries(
      Object.entries(parsed).filter(([, draft]) => {
        if (!draft || typeof draft !== "object") return false
        const candidate = draft as Partial<BulkEditDraft>
        return Boolean(candidate.key && candidate.id && candidate.level && candidate.node?.id)
      }),
    ) as BulkDraftMap
  } catch {
    return {}
  }
}

export function bulkDraftStorageKey(adAccountId: string): string {
  return `ads_manager_bulk_drafts_v1:${adAccountId}`
}
