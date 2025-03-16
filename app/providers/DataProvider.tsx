"use client"

import * as React from "react"

interface DataContextType {
  pages: any[]
  groups: any[]
  loadMorePages: (userId: string) => void
  isMoreLoading: boolean
  hasMorePages: boolean
}

export const DataContext = React.createContext<DataContextType>({
  pages: [],
  groups: [],
  loadMorePages: () => {},
  isMoreLoading: false,
  hasMorePages: false,
})

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [pages, setPages] = React.useState<any[]>([])
  const [groups, setGroups] = React.useState<any[]>([])
  const [isMoreLoading, setIsMoreLoading] = React.useState(false)
  const [hasMorePages, setHasMorePages] = React.useState(false)

  const loadMorePages = async (userId: string) => {
    setIsMoreLoading(true)
    // TODO: Implement loading more pages
    setIsMoreLoading(false)
  }

  return (
    <DataContext.Provider value={{ pages, groups, loadMorePages, isMoreLoading, hasMorePages }}>
      {children}
    </DataContext.Provider>
  )
} 