"use client"

import { IconSearch, IconX } from "@tabler/icons-react"

interface Props {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}

export function InspoSearchBar({ value, onChange, placeholder = "Search for ads by brand or keywords..." }: Props) {
  return (
    <div className="relative flex-1 min-w-0">
      <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 pl-9 pr-8 text-sm bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent placeholder:text-muted-foreground"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          <IconX className="size-4" />
        </button>
      )}
    </div>
  )
}
