import { PerformanceGoal, CampaignObjective } from "./types"

export const COUNTRIES = [
  { name: "Vietnam", code: "VN" },
  { name: "United States", code: "US" },
  { name: "Thailand", code: "TH" },
  { name: "Singapore", code: "SG" },
  { name: "Malaysia", code: "MY" },
  { name: "Indonesia", code: "ID" },
  { name: "Philippines", code: "PH" },
  { name: "Japan", code: "JP" },
  { name: "South Korea", code: "KR" },
  { name: "United Kingdom", code: "GB" },
  { name: "Australia", code: "AU" },
  { name: "Canada", code: "CA" },
  { name: "Germany", code: "DE" },
  { name: "France", code: "FR" },
]

export const ZERO_DECIMAL_CURRENCIES = new Set([
  "BIF",
  "CLP",
  "DJF",
  "GNF",
  "JPY",
  "KMF",
  "KRW",
  "PYG",
  "RWF",
  "UGX",
  "VND",
  "VUV",
  "XAF",
  "XOF",
  "XPF",
])

export function performanceOptions(objective: CampaignObjective): Array<{
  value: PerformanceGoal
  label: string
}> {
  if (objective === "OUTCOME_SALES") {
    return [{ value: "OFFSITE_CONVERSIONS", label: "Maximize website conversions" }]
  }
  if (objective === "OUTCOME_TRAFFIC") {
    return [
      { value: "LINK_CLICKS", label: "Maximize link clicks" },
      { value: "LANDING_PAGE_VIEWS", label: "Maximize landing page views" },
    ]
  }
  return [{ value: "REACH", label: "Maximize reach" }]
}
