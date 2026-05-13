"use client"

import { IconSearch, IconX } from "@tabler/icons-react"

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

export function InspoSearchBar({ value, onChange, placeholder = "Search by brand, keyword, or copy..." }: Props) {
  return (
    <div className="relative flex-1 min-w-0">
      <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 pl-9 pr-8 text-sm bg-muted/50 border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 focus:bg-background placeholder:text-muted-foreground/60 transition-all"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 flex items-center justify-center rounded-full bg-muted-foreground/20 text-muted-foreground hover:bg-muted-foreground/30 transition-colors"
        >
          <IconX className="size-3" />
        </button>
      )}
    </div>
  )
}
