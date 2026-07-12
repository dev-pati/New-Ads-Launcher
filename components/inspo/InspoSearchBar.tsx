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
      <IconSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-500 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 pl-10 pr-9 text-xs bg-white border border-[#dfe3ea] rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-[#1373e6]/20 focus:border-[#1373e6] placeholder:text-slate-500 transition-all"
      />
      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 size-5 flex items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
        >
          <IconX className="size-3" />
        </button>
      )}
    </div>
  )
}
