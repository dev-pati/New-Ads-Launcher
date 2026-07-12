"use client"

import { useState } from "react"
import { IconSearch, IconLoader2, IconBinoculars } from "@tabler/icons-react"
import { BrandCard } from "./BrandCard"
import { BrandDetailPage } from "./BrandDetailPage"
import { useBrandList } from "@/hooks/use-brand-spy"

interface Props {
  initialBrand?: string | null
  onBrandChange?: (brand: string | null) => void
}

export function BrandSpyPage({ initialBrand, onBrandChange }: Props) {
  const [selectedBrand, setSelectedBrand] = useState<string | null>(initialBrand ?? null)
  const { brands, search, setSearch, total } = useBrandList()

  function handleSelect(name: string) {
    setSelectedBrand(name)
    onBrandChange?.(name)
  }

  function handleBack() {
    setSelectedBrand(null)
    onBrandChange?.(null)
  }

  // Brand detail view
  if (selectedBrand) {
    return <BrandDetailPage brandName={selectedBrand} onBack={handleBack} />
  }

  // Brand list view
  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-primary/10 flex items-center justify-center">
              <IconBinoculars className="size-4 text-primary" />
            </div>
            <div>
              <h1 className="text-base font-bold">Brand Spy</h1>
              <p className="text-xs text-muted-foreground">{total} brands tracked</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative w-64">
            <IconSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search brands..."
              className="w-full h-9 pl-8 pr-3 text-sm bg-muted/50 border border-border/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60 transition-all"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {brands.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <IconBinoculars className="size-12 mb-3 opacity-20" />
            <p className="font-medium">No brands found</p>
            <p className="text-sm mt-1">Try a different search term</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground/60 mb-4">
              {brands.length} brand{brands.length !== 1 ? "s" : ""}
              {search.trim() ? ` matching "${search}"` : ""}
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
              {brands.map(brand => (
                <BrandCard
                  key={brand.brandName}
                  brand={brand}
                  onClick={() => handleSelect(brand.brandName)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
