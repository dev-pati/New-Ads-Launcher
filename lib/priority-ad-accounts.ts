// Priority ad accounts that must not be blocked by the workspace (ad_accounts / org)
// membership check. Set real IDs (comma-separated, act_ prefix optional) in PRIORITY_AD_ACCOUNTS.
export const PRIORITY_AD_ACCOUNTS = (process.env.PRIORITY_AD_ACCOUNTS ?? "")
  .split(",")
  .map((s) => s.trim().replace(/^act_/, ""))
  .filter(Boolean)

export function isPriorityAdAccount(actId: string | null | undefined) {
  if (!actId || PRIORITY_AD_ACCOUNTS.length === 0) return false
  return PRIORITY_AD_ACCOUNTS.includes(actId.replace(/^act_/, ""))
}
