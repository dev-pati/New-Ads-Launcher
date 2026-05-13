"use client"

import { IconEye, IconBrandFacebook, IconBrandInstagram, IconBrandTiktok, IconPhoto, IconVideo } from "@tabler/icons-react"
import { cn } from "@/lib/utils"
import { formatViews, formatSpend } from "@/lib/inspo-mock-data"
import type { BrandSummary } from "@/lib/brand-spy-analytics"

function BrandAvatar({ name, src, size = "md" }: { name: string; src?: string; size?: "sm" | "md" | "lg" }) {
  const colors = ["bg-blue-500", "bg-violet-500", "bg-emerald-500", "bg-orange-500", "bg-pink-500", "bg-teal-500", "bg-red-500", "bg-amber-500"]
  const color = colors[name.charCodeAt(0) % colors.length]
  const sz = size === "sm" ? "size-8 text-xs" : size === "lg" ? "size-14 text-xl" : "size-11 text-sm"
  if (src) return (
    <img src={src} alt={name} className={cn(sz, "rounded-full object-cover ring-2 ring-border shrink-0")}
      onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
  )
  return (
    <div className={cn(sz, color, "rounded-full flex items-center justify-center text-white font-bold shrink-0")}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

const PLATFORM_ICON: Record<string, React.ElementType> = {
  facebook: IconBrandFacebook,
  instagram: IconBrandInstagram,
  tiktok: IconBrandTiktok,
}

interface Props {
  brand: BrandSummary
  onClick: () => void
}

export function BrandCard({ brand, onClick }: Props) {
  return (
    <div
      onClick={onClick}
      className="group bg-card border border-border/60 rounded-2xl p-4 cursor-pointer hover:shadow-lg hover:shadow-black/5 hover:-translate-y-0.5 hover:border-border transition-all duration-200"
    >
      <div className="flex items-start gap-3">
        <BrandAvatar name={brand.brandName} src={brand.brandAvatar} />

        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
            {brand.brandName}
          </p>
          {brand.categories[0] && (
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{brand.categories[0]}</p>
          )}

          {/* Platforms */}
          <div className="flex items-center gap-1 mt-1.5">
            {brand.platforms.slice(0, 3).map(p => {
              const Icon = PLATFORM_ICON[p.toLowerCase()] ?? IconEye
              return <Icon key={p} className="size-3.5 text-muted-foreground/60" />
            })}
          </div>
        </div>

        {/* Media type badges */}
        <div className="flex flex-col gap-1 items-end shrink-0">
          {brand.mediaTypes.includes("video") && (
            <span className="flex items-center gap-0.5 text-[9px] font-medium bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-400 px-1.5 py-0.5 rounded">
              <IconVideo className="size-2.5" /> Video
            </span>
          )}
          {brand.mediaTypes.includes("image") && (
            <span className="flex items-center gap-0.5 text-[9px] font-medium bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded">
              <IconPhoto className="size-2.5" /> Image
            </span>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/50">
        <div>
          <p className="text-[10px] text-muted-foreground/70 uppercase font-medium">Ads</p>
          <p className="text-[13px] font-bold tabular-nums">{brand.totalAds}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground/70 uppercase font-medium">Reach</p>
          <p className="text-[13px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{formatViews(brand.totalReach)}</p>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground/70 uppercase font-medium">Spend</p>
          <p className="text-[13px] font-bold tabular-nums">{formatSpend(brand.totalSpend)}</p>
        </div>
      </div>
    </div>
  )
}

export { BrandAvatar }
