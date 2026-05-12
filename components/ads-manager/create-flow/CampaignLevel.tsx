"use client"

import {
  IconChartArrowsVertical,
  IconSpeakerphone,
  IconShoppingCart,
} from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import {
  CampaignFormState,
  CampaignObjective,
  PerformanceGoal,
  SpecialAdCategory,
} from "./types"

interface Props {
  state: CampaignFormState
  update: (updates: Partial<CampaignFormState>) => void
  currency: string
}

const OBJECTIVES: Array<{
  value: CampaignObjective
  label: string
  desc: string
  icon: React.ElementType
  defaultGoal: PerformanceGoal
}> = [
  {
    value: "OUTCOME_SALES",
    label: "Sales",
    desc: "Create a website conversion campaign using a Pixel purchase event.",
    icon: IconShoppingCart,
    defaultGoal: "OFFSITE_CONVERSIONS",
  },
  {
    value: "OUTCOME_TRAFFIC",
    label: "Traffic",
    desc: "Send people to a website and optimize for link clicks or landing page views.",
    icon: IconChartArrowsVertical,
    defaultGoal: "LINK_CLICKS",
  },
  {
    value: "OUTCOME_AWARENESS",
    label: "Awareness",
    desc: "Reach people in your selected countries with a paused awareness campaign.",
    icon: IconSpeakerphone,
    defaultGoal: "REACH",
  },
]

const SPECIAL_CATEGORIES: Array<{ value: SpecialAdCategory; label: string }> = [
  { value: "CREDIT", label: "Credit" },
  { value: "EMPLOYMENT", label: "Employment" },
  { value: "HOUSING", label: "Housing" },
  { value: "ISSUES_ELECTIONS_POLITICS", label: "Social issues, elections or politics" },
]

const ZERO_DECIMAL_CURRENCIES = new Set([
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

export function CampaignLevel({ state, update, currency }: Props) {
  const budgetStep = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? "1" : "0.01"

  const toggleCategory = (category: SpecialAdCategory) => {
    update({
      specialAdCategories: state.specialAdCategories.includes(category)
        ? state.specialAdCategories.filter((item) => item !== category)
        : [...state.specialAdCategories, category],
    })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-[#1c2b33] dark:text-gray-100">Campaign</h1>
      </div>

      <div className="space-y-4 rounded-lg border border-[#e4e6eb] p-5 shadow-sm dark:border-gray-800">
        <div>
          <label className="text-[13px] font-semibold text-[#1c2b33] dark:text-gray-200">
            Campaign name
          </label>
          <input
            type="text"
            className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-[13px] outline-none focus:border-[#1877f2] focus:ring-1 focus:ring-[#1877f2] dark:border-gray-700 dark:bg-background"
            value={state.campaignName}
            onChange={(event) => update({ campaignName: event.target.value })}
            placeholder="Enter a campaign name"
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-[#e4e6eb] p-5 shadow-sm dark:border-gray-800">
        <div>
          <h3 className="text-[15px] font-semibold text-[#1c2b33] dark:text-gray-100">
            Special Ad Categories
          </h3>
          <p className="mt-1 text-[13px] text-[#65676b]">
            Select only categories that apply. Leave all unchecked for no categories.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {SPECIAL_CATEGORIES.map((category) => (
            <label
              key={category.value}
              className="flex cursor-pointer items-center gap-2 rounded border border-[#ccd0d5] px-3 py-2 text-[13px] dark:border-gray-700"
            >
              <input
                type="checkbox"
                className="size-4 accent-[#1877f2]"
                checked={state.specialAdCategories.includes(category.value)}
                onChange={() => toggleCategory(category.value)}
              />
              <span className="text-[#1c2b33] dark:text-gray-200">{category.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-[#e4e6eb] p-5 shadow-sm dark:border-gray-800">
        <h3 className="text-[15px] font-semibold text-[#1c2b33] dark:text-gray-100">
          Campaign details
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-[13px] text-[#1c2b33] dark:text-gray-300">Buying type</span>
          <span className="text-[13px] font-medium text-[#4b4f56] dark:text-gray-400">Auction</span>
        </div>

        <div className="space-y-2">
          <span className="block text-[13px] text-[#1c2b33] dark:text-gray-300">
            Campaign objective
          </span>
          <div className="grid gap-3 sm:grid-cols-3">
            {OBJECTIVES.map((objective) => {
              const selected = state.objective === objective.value
              const Icon = objective.icon
              return (
                <button
                  key={objective.value}
                  type="button"
                  onClick={() =>
                    update({ objective: objective.value, performanceGoal: objective.defaultGoal })
                  }
                  className={cn(
                    "flex min-h-[132px] flex-col items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                    selected
                      ? "border-[#1877f2] bg-[#e3f0fe]/30 ring-1 ring-[#1877f2] dark:bg-blue-900/20"
                      : "border-[#ccd0d5] hover:bg-[#f5f6f7] dark:border-gray-700 dark:hover:bg-muted/50"
                  )}
                >
                  <span className={cn("rounded-full p-1.5", selected ? "bg-[#1877f2]/10" : "bg-muted")}>
                    <Icon className={cn("size-4", selected ? "text-[#1877f2]" : "text-muted-foreground")} />
                  </span>
                  <span>
                    <span
                      className={cn(
                        "block text-[13px] font-semibold",
                        selected ? "text-[#1877f2]" : "text-[#1c2b33] dark:text-gray-200"
                      )}
                    >
                      {objective.label}
                    </span>
                    <span className="mt-1 block text-[11px] leading-snug text-[#65676b]">
                      {objective.desc}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-[#e4e6eb] p-5 shadow-sm dark:border-gray-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-[15px] font-semibold text-[#1c2b33] dark:text-gray-100">
              Advantage campaign budget
            </h3>
            <p className="mt-1 text-[13px] text-[#65676b]">
              When enabled, the daily budget is set at campaign level. When disabled, budget is set on the ad set.
            </p>
          </div>
          <button
            type="button"
            onClick={() => update({ advantageCampaignBudget: !state.advantageCampaignBudget })}
            className={cn(
              "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
              state.advantageCampaignBudget ? "bg-[#1877f2]" : "bg-[#c9ccd1] dark:bg-gray-600"
            )}
            aria-label="Toggle campaign budget"
          >
            <span
              className={cn(
                "inline-block size-4 rounded-full bg-white shadow-sm transition-transform",
                state.advantageCampaignBudget ? "translate-x-4" : "translate-x-1"
              )}
            />
          </button>
        </div>

        {state.advantageCampaignBudget && (
          <div className="border-t border-[#e4e6eb] pt-4 dark:border-gray-800">
            <label className="text-[13px] font-semibold text-[#1c2b33] dark:text-gray-200">
              Daily campaign budget
            </label>
            <div className="relative mt-1.5 max-w-[220px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-[#65676b]">
                {currency}
              </span>
              <input
                type="number"
                min="1"
                step={budgetStep}
                value={state.campaignBudget}
                onChange={(event) => update({ campaignBudget: event.target.value })}
                className="h-9 w-full rounded border border-[#ccd0d5] bg-white pl-14 pr-3 text-[13px] outline-none focus:border-[#1877f2] focus:ring-1 focus:ring-[#1877f2] dark:border-gray-700 dark:bg-background"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
