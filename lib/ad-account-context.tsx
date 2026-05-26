"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"
import { useOrg } from "@/lib/org-context"

interface AdAccount {
  id: string
  account_id: string
  name: string
  currency: string
  account_status?: number
  amount_spent?: string
  balance?: string
}

interface AdAccountContextType {
  adAccounts: AdAccount[]
  selectedAccountId: string
  selectedAccount: AdAccount | null
  setSelectedAccountId: (id: string) => void
  loading: boolean
}

const STORAGE_KEY = "selected_ad_account_id"

const AdAccountContext = createContext<AdAccountContextType>({
  adAccounts: [],
  selectedAccountId: "",
  selectedAccount: null,
  setSelectedAccountId: () => {},
  loading: true,
})

export function useAdAccount() {
  return useContext(AdAccountContext)
}

export function AdAccountProvider({ children }: { children: React.ReactNode }) {
  const { activeOrgId } = useOrg()
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [selectedAccountId, setSelectedAccountIdState] = useState("")
  const [loading, setLoading] = useState(true)
  const storageKey = activeOrgId ? `${STORAGE_KEY}:${activeOrgId}` : STORAGE_KEY

  useEffect(() => {
    let cancelled = false

    async function loadAdAccounts() {
      await Promise.resolve()
      if (cancelled) return

      if (!activeOrgId) {
        setAdAccounts([])
        setSelectedAccountIdState("")
        setLoading(false)
        return
      }

      setLoading(true)
      setAdAccounts([])
      setSelectedAccountIdState("")

      try {
        const res = await fetch("/api/facebook/ad-accounts")
        const d = await res.json().catch(() => ({}))
        if (cancelled) return
        const accounts: AdAccount[] = d.adAccounts || []
        setAdAccounts(accounts)
        if (accounts.length > 0) {
          const stored = localStorage.getItem(storageKey)
          const valid = stored && accounts.find(a => a.id === stored)
          setSelectedAccountIdState(valid ? stored : accounts[0].id)
        }
      } catch {
        if (!cancelled) setAdAccounts([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadAdAccounts()

    return () => {
      cancelled = true
    }
  }, [activeOrgId, storageKey])

  const setSelectedAccountId = useCallback((id: string) => {
    setSelectedAccountIdState(id)
    localStorage.setItem(storageKey, id)
  }, [storageKey])

  const selectedAccount = adAccounts.find(a => a.id === selectedAccountId) || null

  return (
    <AdAccountContext.Provider value={{ adAccounts, selectedAccountId, selectedAccount, setSelectedAccountId, loading }}>
      {children}
    </AdAccountContext.Provider>
  )
}
