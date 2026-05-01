"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"

interface AdAccount {
  id: string
  account_id: string
  name: string
  currency: string
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
  const [adAccounts, setAdAccounts] = useState<AdAccount[]>([])
  const [selectedAccountId, setSelectedAccountIdState] = useState("")
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/facebook/ad-accounts")
      .then(r => r.json())
      .then(d => {
        const accounts: AdAccount[] = d.adAccounts || []
        setAdAccounts(accounts)
        if (accounts.length > 0) {
          const stored = localStorage.getItem(STORAGE_KEY)
          const valid = stored && accounts.find(a => a.id === stored)
          setSelectedAccountIdState(valid ? stored : accounts[0].id)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const setSelectedAccountId = useCallback((id: string) => {
    setSelectedAccountIdState(id)
    localStorage.setItem(STORAGE_KEY, id)
  }, [])

  const selectedAccount = adAccounts.find(a => a.id === selectedAccountId) || null

  return (
    <AdAccountContext.Provider value={{ adAccounts, selectedAccountId, selectedAccount, setSelectedAccountId, loading }}>
      {children}
    </AdAccountContext.Provider>
  )
}
