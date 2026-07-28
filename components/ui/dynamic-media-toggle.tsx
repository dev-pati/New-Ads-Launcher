import { cn } from "@/lib/utils"

export function DynamicMediaToggle({ title, desc, checked, onChange, disabled, indent }: {
  title: string; desc: string; checked: boolean
  onChange: (v: boolean) => void; disabled?: boolean; indent?: boolean
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3", indent && "pl-4")}>
      <div className={cn("flex-1", disabled && "opacity-50")}>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={cn("relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
          checked && !disabled ? "bg-primary" : "bg-muted-foreground/30",
          disabled && "opacity-50 cursor-not-allowed")}
      >
        <span className={cn("inline-block size-3.5 rounded-full bg-white shadow-sm transition-transform",
          checked && !disabled ? "translate-x-4" : "translate-x-0.5")} />
      </button>
    </div>
  )
}
