"use client"

import { useState } from "react"
import { IconChevronDown } from "@tabler/icons-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import type { BulkDraftField, BulkDraftLevel } from "@/lib/ads-manager-bulk-drafts"

export type BulkEditFieldOption = {
  label: string
  action?: BulkDraftField
}

export type BulkEditFieldGroup = {
  label: string
  fields: BulkEditFieldOption[]
}

export const BULK_EDIT_FIELD_GROUPS: Record<BulkDraftLevel, BulkEditFieldGroup[]> = {
  campaign: [
    {
      label: "General",
      fields: [
        { label: "Turn on", action: "turn_on" },
        { label: "Turn off", action: "turn_off" },
        { label: "Name", action: "name" },
        { label: "Find and replace" },
      ],
    },
    {
      label: "Campaign details",
      fields: [{ label: "Campaign spending limit" }],
    },
  ],
  adset: [
    {
      label: "General",
      fields: [
        { label: "Turn on", action: "turn_on" },
        { label: "Turn off", action: "turn_off" },
        { label: "Name", action: "name" },
        { label: "Find and replace" },
      ],
    },
    {
      label: "Budget & schedule",
      fields: [
        { label: "Budget", action: "budget" },
        { label: "Start date" },
        { label: "End date" },
        { label: "Minimum spend limit" },
        { label: "Maximum spend limit" },
      ],
    },
    {
      label: "Audience controls",
      fields: [
        { label: "Location" },
        { label: "Minimum age" },
        { label: "Exclude custom audiences" },
      ],
    },
    {
      label: "Audience",
      fields: [
        { label: "Custom Audience" },
        { label: "Age" },
        { label: "Gender" },
        { label: "Detailed targeting" },
        { label: "Languages" },
      ],
    },
    {
      label: "Placements",
      fields: [{ label: "Placements" }],
    },
    {
      label: "Optimisation & delivery",
      fields: [
        { label: "Conversion location" },
        { label: "Performance goal" },
        { label: "Bid strategy" },
        { label: "Cost per result goal" },
        { label: "Attribution setting" },
      ],
    },
  ],
  ad: [
    {
      label: "General",
      fields: [
        { label: "Turn on", action: "turn_on" },
        { label: "Turn off", action: "turn_off" },
        { label: "Name", action: "name" },
        { label: "Start date" },
        { label: "End date" },
        { label: "Find and replace" },
      ],
    },
    {
      label: "Identity",
      fields: [{ label: "Page" }],
    },
    {
      label: "Creative",
      fields: [
        { label: "Website URL" },
        { label: "Display link" },
        { label: "Shop" },
        { label: "Product browsing" },
        { label: "Media" },
        { label: "Primary text" },
        { label: "Headline" },
        { label: "Multi-advertiser ads" },
        { label: "Creative setup" },
        { label: "Advantage+ creative" },
        { label: "Description" },
        { label: "Call to action" },
      ],
    },
    {
      label: "Tracking",
      fields: [{ label: "URL parameters" }],
    },
  ],
}

export function BulkEditFieldMenu({
  level,
  disabled,
  onSelect,
}: {
  level: BulkDraftLevel
  disabled?: boolean
  onSelect: (field: BulkDraftField) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={disabled}
          aria-label="Show bulk edit fields"
          className="flex h-7 w-8 items-center justify-center rounded-r border border-l-0 border-[#ccd0d5] bg-[#f5f6f7] text-[#4b4f56] shadow-sm transition-colors hover:bg-[#ebedf0] disabled:opacity-40 dark:border-gray-700 dark:bg-muted dark:text-gray-300"
        >
          <IconChevronDown className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={4} className="max-h-[520px] w-72 overflow-y-auto p-0">
        {BULK_EDIT_FIELD_GROUPS[level].map((group, groupIndex) => (
          <div key={group.label} className={cn("py-1.5", groupIndex > 0 && "border-t")}>
            <p className="px-3 py-1 text-xs font-bold text-[#1c2b33] dark:text-foreground">{group.label}</p>
            {group.fields.map(field => {
              const ready = Boolean(field.action)
              return (
                <button
                  key={field.label}
                  type="button"
                  disabled={!ready}
                  onClick={() => {
                    if (!field.action) return
                    onSelect(field.action)
                    setOpen(false)
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 px-3 py-1.5 text-left text-sm",
                    ready ? "hover:bg-muted/60" : "cursor-not-allowed text-muted-foreground opacity-45",
                  )}
                >
                  <span>{field.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
