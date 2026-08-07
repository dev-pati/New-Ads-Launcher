"use client"

import { createContext, useCallback, useContext, useState } from "react"

interface HelpContextType {
  isOpen: boolean
  activeTermKey: string | null
  openHelp: (termKey?: string) => void
  closeHelp: () => void
}

const HelpContext = createContext<HelpContextType>({
  isOpen: false,
  activeTermKey: null,
  openHelp: () => {},
  closeHelp: () => {},
})

export function useHelp() {
  return useContext(HelpContext)
}

export function HelpProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTermKey, setActiveTermKey] = useState<string | null>(null)

  const openHelp = useCallback((termKey?: string) => {
    setActiveTermKey(termKey ?? null)
    setIsOpen(true)
  }, [])

  const closeHelp = useCallback(() => {
    setIsOpen(false)
  }, [])

  return (
    <HelpContext.Provider value={{ isOpen, activeTermKey, openHelp, closeHelp }}>
      {children}
    </HelpContext.Provider>
  )
}
