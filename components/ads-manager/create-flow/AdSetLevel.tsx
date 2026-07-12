"use client"

import { CampaignFormState, PerformanceGoal, PixelOption } from "./types"

interface Props {
  state: CampaignFormState
  update: (updates: Partial<CampaignFormState>) => void
  pixels: PixelOption[]
  pixelsLoading: boolean
  currency: string
}

const COUNTRIES = [
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

function performanceOptions(objective: CampaignFormState["objective"]): Array<{
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

export function AdSetLevel({ state, update, pixels, pixelsLoading, currency }: Props) {
  const options = performanceOptions(state.objective)
  const budgetStep = ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase()) ? "1" : "0.01"

  const addCountry = (code: string) => {
    if (!state.locations.includes(code)) update({ locations: [...state.locations, code] })
  }

  const removeCountry = (code: string) => {
    update({ locations: state.locations.filter((item) => item !== code) })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-6 py-8 pb-20">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold text-[#1c2b33] dark:text-gray-100">Ad Set</h1>
      </div>

      <div className="space-y-4 rounded-lg border border-[#e4e6eb] p-5 shadow-sm dark:border-gray-800">
        <div>
          <label className="text-xs font-semibold text-[#1c2b33] dark:text-gray-200">
            Ad set name
          </label>
          <input
            type="text"
            className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-xs outline-none focus:border-[#1877f2] focus:ring-1 focus:ring-[#1877f2] dark:border-gray-700 dark:bg-background"
            value={state.adSetName}
            onChange={(event) => update({ adSetName: event.target.value })}
            placeholder="Enter an ad set name"
          />
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-[#e4e6eb] p-5 shadow-sm dark:border-gray-800">
        <h3 className="text-sm font-semibold text-[#1c2b33] dark:text-gray-100">Conversion</h3>
        <div>
          <label className="text-xs font-semibold text-[#1c2b33] dark:text-gray-200">
            Conversion location
          </label>
          <div className="mt-2 rounded-lg border border-[#1877f2] bg-[#e3f0fe]/30 p-3 dark:bg-blue-900/20">
            <span className="block text-xs font-semibold text-[#1877f2]">Website</span>
            <span className="mt-0.5 block text-xs text-[#65676b]">
              Ads will send people to your selected website URL.
            </span>
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold text-[#1c2b33] dark:text-gray-200">
            Performance goal
          </label>
          <select
            value={state.performanceGoal}
            onChange={(event) => update({ performanceGoal: event.target.value as PerformanceGoal })}
            className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-xs outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {state.objective === "OUTCOME_SALES" && (
          <div>
            <label className="text-xs font-semibold text-[#1c2b33] dark:text-gray-200">
              Pixel
            </label>
            <select
              value={state.pixelId}
              onChange={(event) => update({ pixelId: event.target.value })}
              className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-xs outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
              disabled={pixelsLoading}
            >
              <option value="">{pixelsLoading ? "Loading Pixels..." : "Select a Pixel"}</option>
              {pixels.map((pixel) => (
                <option key={pixel.id} value={pixel.id}>
                  {pixel.name} ({pixel.id})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-4 rounded-lg border border-[#e4e6eb] p-5 shadow-sm dark:border-gray-800">
        <h3 className="text-sm font-semibold text-[#1c2b33] dark:text-gray-100">
          Budget & schedule
        </h3>

        {!state.advantageCampaignBudget && (
          <div className="border-b border-[#e4e6eb] pb-4 dark:border-gray-800">
            <label className="text-xs font-semibold text-[#1c2b33] dark:text-gray-200">
              Daily ad set budget
            </label>
            <div className="relative mt-1.5 max-w-[220px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#65676b]">
                {currency}
              </span>
              <input
                type="number"
                min="1"
                step={budgetStep}
                value={state.dailyBudget}
                onChange={(event) => update({ dailyBudget: event.target.value })}
                className="h-9 w-full rounded border border-[#ccd0d5] bg-white pl-14 pr-3 text-xs outline-none focus:border-[#1877f2] focus:ring-1 focus:ring-[#1877f2] dark:border-gray-700 dark:bg-background"
              />
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-[#1c2b33] dark:text-gray-200">
              Start date
            </label>
            <input
              type="datetime-local"
              value={state.scheduleStart}
              onChange={(event) => update({ scheduleStart: event.target.value })}
              className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-xs outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#1c2b33] dark:text-gray-200">
              End date
            </label>
            <input
              type="datetime-local"
              value={state.scheduleEnd}
              onChange={(event) => update({ scheduleEnd: event.target.value })}
              className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-xs outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4 rounded-lg border border-[#e4e6eb] p-5 shadow-sm dark:border-gray-800">
        <h3 className="text-sm font-semibold text-[#1c2b33] dark:text-gray-100">Audience</h3>

        <div>
          <label className="text-xs font-semibold text-[#1c2b33] dark:text-gray-200">
            Countries
          </label>
          <div className="mt-1.5 rounded border border-[#ccd0d5] bg-white p-2 dark:border-gray-700 dark:bg-background">
            <div className="mb-2 flex min-h-8 flex-wrap gap-2">
              {state.locations.map((countryCode) => (
                <span
                  key={countryCode}
                  className="inline-flex items-center gap-1.5 rounded-sm border border-[#d1e7ff] bg-[#e7f3ff] px-2.5 py-1 text-xs font-medium text-[#1877f2]"
                >
                  {countryCode}
                  <button
                    type="button"
                    onClick={() => removeCountry(countryCode)}
                    className="flex size-4 items-center justify-center rounded-full hover:bg-[#d1e7ff]"
                    aria-label={`Remove ${countryCode}`}
                  >
                    x
                  </button>
                </span>
              ))}
            </div>
            <select
              value=""
              onChange={(event) => {
                if (event.target.value) addCountry(event.target.value)
              }}
              className="h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-xs outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
            >
              <option value="">Add country...</option>
              {COUNTRIES.filter((country) => !state.locations.includes(country.code)).map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name} ({country.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-[#1c2b33] dark:text-gray-200">Age</label>
            <div className="mt-1.5 flex items-center gap-2">
              <select
                value={state.ageMin}
                onChange={(event) => update({ ageMin: Number(event.target.value) })}
                className="h-9 flex-1 rounded border border-[#ccd0d5] bg-white px-2 text-xs outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
              >
                {Array.from({ length: 48 }, (_, index) => index + 18).map((age) => (
                  <option key={age} value={age}>
                    {age}
                  </option>
                ))}
              </select>
              <span className="text-xs text-[#65676b]">to</span>
              <select
                value={state.ageMax}
                onChange={(event) => update({ ageMax: Number(event.target.value) })}
                className="h-9 flex-1 rounded border border-[#ccd0d5] bg-white px-2 text-xs outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
              >
                {Array.from({ length: 48 }, (_, index) => index + 18).map((age) => (
                  <option key={age} value={age}>
                    {age === 65 ? "65+" : age}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-[#1c2b33] dark:text-gray-200">
              Gender
            </label>
            <select
              value={state.gender}
              onChange={(event) => update({ gender: event.target.value as CampaignFormState["gender"] })}
              className="mt-1.5 h-9 w-full rounded border border-[#ccd0d5] bg-white px-3 text-xs outline-none focus:border-[#1877f2] dark:border-gray-700 dark:bg-background"
            >
              <option value="ALL">All genders</option>
              <option value="MALE">Men</option>
              <option value="FEMALE">Women</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-2 rounded-lg border border-[#e4e6eb] p-5 shadow-sm dark:border-gray-800">
        <h3 className="text-sm font-semibold text-[#1c2b33] dark:text-gray-100">Placements</h3>
        <div className="rounded-lg border border-[#1877f2] bg-[#e3f0fe]/30 p-3 dark:bg-blue-900/20">
          <span className="block text-xs font-semibold text-[#1877f2]">
            Advantage+ placements
          </span>
          <span className="mt-0.5 block text-xs text-[#65676b]">
            Meta will place ads across eligible inventory.
          </span>
        </div>
      </div>
    </div>
  )
}
