"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  IconBolt,
  IconPlus,
  IconTemplate,
  IconCheck,
  IconBell,
  IconHistory,
  IconListDetails,
} from "@tabler/icons-react"

type SubTab = "automations" | "templates" | "active" | "approvals" | "notifications" | "history"

export default function AutomatePage() {
  const [subTab, setSubTab] = useState<SubTab>("automations")

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-6 py-5 border-b shrink-0">
        <h1 className="font-heading text-xl font-bold">Automate</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Schedule Meta actions automatically with rule-based automations.
        </p>
      </div>

      <div className="flex items-center gap-0 px-6 border-b shrink-0">
        {[
          { id: "automations", label: "My Automations" },
          { id: "templates", label: "Templates" },
          { id: "active", label: "Active" },
          { id: "approvals", label: "Approvals" },
          { id: "notifications", label: "Notifications" },
          { id: "history", label: "History" },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setSubTab(t.id as SubTab)}
            className={cn(
              "px-0 py-3 mr-6 text-sm border-b-2 transition-colors",
              subTab === t.id
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="size-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <IconBolt className="size-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">No automations yet</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-sm">
            Create your first automation to schedule Meta actions automatically.
          </p>
          <Button className="mt-4 gap-1.5" disabled>
            <IconPlus className="size-4" />
            Create Automation
          </Button>
        </div>
      </div>
    </div>
  )
}
