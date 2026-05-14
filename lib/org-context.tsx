"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"

interface Org {
  id: string
  name: string
  slug: string
  role: string
}

interface OrgContextType {
  orgs: Org[]
  activeOrgId: string | null
  activeOrg: Org | null
  switchOrg: (orgId: string) => void
  refreshOrgs: () => Promise<void>
  hasOrg: boolean
  loading: boolean
}

const OrgContext = createContext<OrgContextType>({
  orgs: [],
  activeOrgId: null,
  activeOrg: null,
  switchOrg: () => {},
  refreshOrgs: async () => {},
  hasOrg: false,
  loading: true,
})

export function useOrg() {
  return useContext(OrgContext)
}

export function OrgProvider({ children }: { children: React.ReactNode }) {
  const [orgs, setOrgs] = useState<Org[]>([])
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchOrgs = useCallback(async () => {
    const res = await fetch("/api/orgs")
    if (!res.ok) {
      setLoading(false)
      return
    }
    const { orgs: data } = await res.json()

    if (data && data.length > 0) {
      const orgList: Org[] = data.map((o: any) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        role: o.role,
      }))
      setOrgs(orgList)

      const stored = document.cookie
        .split("; ")
        .find((c) => c.startsWith("active_org_id="))
        ?.split("=")[1]

      const validStored = stored && orgList.find((o) => o.id === stored)
      const defaultOrg = validStored ? stored : orgList[0].id
      setActiveOrgId(defaultOrg)
      document.cookie = `active_org_id=${defaultOrg}; path=/; max-age=${60 * 60 * 24 * 365}`
    } else {
      setOrgs([])
      setActiveOrgId(null)
    }

    setLoading(false)
  }, [])


  useEffect(() => {
    fetchOrgs()
  }, [fetchOrgs])

  const switchOrg = useCallback((orgId: string) => {
    setActiveOrgId(orgId)
    document.cookie = `active_org_id=${orgId}; path=/; max-age=${60 * 60 * 24 * 365}`
    window.location.reload()
  }, [])

  const activeOrg = orgs.find((o) => o.id === activeOrgId) || null
  const hasOrg = orgs.length > 0

  return (
    <OrgContext.Provider value={{ orgs, activeOrgId, activeOrg, switchOrg, refreshOrgs: fetchOrgs, hasOrg, loading }}>
      {children}
    </OrgContext.Provider>
  )
}
