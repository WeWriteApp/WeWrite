"use client"

import * as React from "react"
import { PageHeader } from "../../components/PageHeader"
import { useTheme } from "../../providers/ThemeProvider"
import { useParams } from "next/navigation"

interface Page {
  id: string
  title: string
  content: string
  userId: string
  username: string
  groupId: string | null
  isPublic: boolean
}

export default function Page() {
  const params = useParams()
  const { theme } = useTheme()
  const [page, setPage] = React.useState<Page | null>(null)
  const [userGroups, setUserGroups] = React.useState([])

  // Fetch page data
  React.useEffect(() => {
    // TODO: Implement page fetching
  }, [params.id])

  if (!page) {
    return <div>Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PageHeader
        title={page.title}
        username={page.username}
        userGroups={userGroups}
        currentGroupId={page.groupId}
        onGroupChange={(groupId) => {
          // TODO: Implement group change
          console.log("Change group to:", groupId)
        }}
        isPublic={page.isPublic}
        onPrivacyChange={(isPublic) => {
          // TODO: Implement privacy change
          console.log("Change privacy to:", isPublic)
        }}
      />
      <main className="container mx-auto py-6">
        {/* Page content will go here */}
      </main>
    </div>
  )
} 