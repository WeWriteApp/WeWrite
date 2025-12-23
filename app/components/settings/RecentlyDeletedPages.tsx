'use client'

import React, { useState, useEffect } from 'react'
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { useAuth } from '../../providers/AuthProvider';
import PillLink from '../utils/PillLink'

interface DeletedPage {
  id: string
  title: string
  deletedAt: string
  deletedBy: string
  isPublic: boolean
  lastModified: string
  createdAt: string
}

export default function RecentlyDeletedPages() {
  const { user } = useAuth();
  const [deletedPages, setDeletedPages] = useState<DeletedPage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [permanentlyDeleting, setPermanentlyDeleting] = useState<string | null>(null)

  // Fetch recently deleted pages (within last 30 days)
  const fetchDeletedPages = async () => {
    if (!user?.uid) return

    try {
      setLoading(true)
      setError(null)

      console.log('Fetching deleted pages for user:', user.uid)

      // Call API endpoint to get deleted pages
      const response = await fetch(`/api/pages?userId=${user.uid}&includeDeleted=true&orderBy=deletedAt&orderDirection=desc&limit=100`)

      if (!response.ok) {
        throw new Error(`Failed to fetch deleted pages: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch deleted pages')
      }

      const pages: DeletedPage[] = result.data.pages
        .filter((page: any) => {
          // Only include pages deleted within the last 30 days
          if (!page.deletedAt) return false

          const deletedDate = new Date(page.deletedAt)
          const thirtyDaysAgo = new Date()
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

          return deletedDate >= thirtyDaysAgo
        })
        .map((page: any) => ({
          id: page.id,
          title: page.title || 'Untitled Page',
          deletedAt: page.deletedAt,
          deletedBy: page.deletedBy || page.userId,
          isPublic: page.isPublic || false,
          lastModified: page.lastModified,
          createdAt: page.createdAt
        }))

      console.log(`Found ${pages.length} deleted pages`)
      setDeletedPages(pages)
    } catch (err) {
      console.error('Error fetching deleted pages:', err)

      // Provide more specific error messages
      let errorMessage = 'Failed to load recently deleted pages'
      if (err instanceof Error) {
        if (err.message.includes('401') || err.message.includes('Unauthorized')) {
          errorMessage = 'Please log in to view deleted pages'
        } else if (err.message.includes('403') || err.message.includes('Forbidden')) {
          errorMessage = 'Permission denied. Please check your account settings.'
        } else if (err.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.'
        } else {
          errorMessage = err.message
        }
      }

      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  // Restore a deleted page
  const restorePage = async (pageId: string) => {
    try {
      setRestoring(pageId)
      setError(null)

      // Call API endpoint to restore page
      const response = await fetch('/api/pages/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageId
        })
      })

      if (!response.ok) {
        const errorResult = await response.json()
        throw new Error(errorResult.error || `Failed to restore page: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to restore page')
      }

      // Remove from the deleted pages list
      setDeletedPages(prev => prev.filter(page => page.id !== pageId))

      console.log('Page restored successfully:', result.data.message)
    } catch (err) {
      console.error('Error restoring page:', err)

      let errorMessage = 'Failed to restore page'
      if (err instanceof Error) {
        if (err.message.includes('401') || err.message.includes('Unauthorized')) {
          errorMessage = 'Please log in to restore pages'
        } else if (err.message.includes('403') || err.message.includes('Forbidden')) {
          errorMessage = 'You can only restore your own pages'
        } else if (err.message.includes('expired')) {
          errorMessage = 'Page deletion period has expired (30 days)'
        } else {
          errorMessage = err.message
        }
      }

      setError(errorMessage)
    } finally {
      setRestoring(null)
    }
  }

  // Permanently delete a page
  const permanentlyDeletePage = async (pageId: string) => {
    if (!confirm('Are you sure you want to permanently delete this page? This action cannot be undone.')) {
      return
    }

    try {
      setPermanentlyDeleting(pageId)
      setError(null)

      // Call API endpoint to permanently delete page
      const response = await fetch(`/api/pages?id=${pageId}&permanent=true`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const errorResult = await response.json()
        throw new Error(errorResult.error || `Failed to permanently delete page: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to permanently delete page')
      }

      // Remove from the deleted pages list
      setDeletedPages(prev => prev.filter(page => page.id !== pageId))

      console.log('Page permanently deleted:', result.data.message)
    } catch (err) {
      console.error('Error permanently deleting page:', err)

      let errorMessage = 'Failed to permanently delete page'
      if (err instanceof Error) {
        if (err.message.includes('401') || err.message.includes('Unauthorized')) {
          errorMessage = 'Please log in to delete pages'
        } else if (err.message.includes('403') || err.message.includes('Forbidden')) {
          errorMessage = 'You can only delete your own pages'
        } else {
          errorMessage = err.message
        }
      }

      setError(errorMessage)
    } finally {
      setPermanentlyDeleting(null)
    }
  }

  // Delete all recently deleted pages permanently
  const deleteAllPermanently = async () => {
    if (!confirm(`Are you sure you want to permanently delete all ${deletedPages.length} recently deleted pages? This action cannot be undone.`)) {
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Use API instead of direct Firebase calls
      await Promise.all(
        deletedPages.map(async (page) => {
          const response = await fetch(`/api/pages?id=${page.id}&permanent=true`, {
            method: 'DELETE'
          });

          if (!response.ok) {
            const errorResult = await response.json();
            throw new Error(errorResult.error || `Failed to permanently delete page ${page.id}`);
          }
        })
      )

      setDeletedPages([])
    } catch (err) {
      console.error('Error deleting all pages:', err)
      setError('Failed to delete all pages')
    } finally {
      setLoading(false)
    }
  }

  // Format date for display
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return 'Unknown date'
    }
  }

  // Calculate days until permanent deletion
  const getDaysUntilPermanentDeletion = (deletedAt: string) => {
    try {
      const deletedDate = new Date(deletedAt)
      const expiryDate = new Date(deletedDate)
      expiryDate.setDate(expiryDate.getDate() + 30)
      
      const now = new Date()
      const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      
      return Math.max(0, daysLeft)
    } catch {
      return 0
    }
  }

  // Retry function
  const retryFetch = () => {
    setRetryCount(prev => prev + 1)
    fetchDeletedPages()
  }

  useEffect(() => {
    fetchDeletedPages()
  }, [user?.uid])

  if (loading) {
    return (
      <Card className="wewrite-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground text-lg sm:text-xl">
            <Icon name="Trash2" size={16} className="sm:h-5 sm:w-5 text-muted-foreground" />
            Recently Deleted Pages
          </CardTitle>
          <CardDescription className="text-sm">
            Pages deleted within the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6 sm:py-8">
            <Icon name="Loader" size={28} className="mx-auto" />
            <p className="mt-2 text-sm text-muted-foreground">Loading deleted pages...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="wewrite-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground text-lg sm:text-xl">
          <Icon name="Trash2" size={16} className="sm:h-5 sm:w-5 text-muted-foreground" />
          Recently Deleted Pages
        </CardTitle>
        <CardDescription className="text-sm">
          Pages deleted within the last 30 days. They will be permanently deleted after 30 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 sm:p-4 bg-destructive/10 border-theme-strong rounded-lg">
            <div className="flex items-start gap-2 text-destructive mb-3">
              <Icon name="AlertTriangle" size={16} className="mt-0.5 shrink-0" />
              <span className="text-sm font-medium leading-relaxed">{error}</span>
            </div>
            {retryCount < 3 && (
              <Button onClick={retryFetch} variant="secondary" size="sm" className="w-full sm:w-auto border-destructive/30 text-destructive hover:bg-destructive/10">
                Try Again {retryCount > 0 && `(${retryCount}/3)`}
              </Button>
            )}
            {retryCount >= 3 && (
              <div className="space-y-3">
                <p className="text-xs text-destructive/80 leading-relaxed">
                  Multiple attempts failed. Please try refreshing the page or contact support.
                </p>
                <Button onClick={() => window.location.reload()} variant="secondary" size="sm" className="w-full sm:w-auto border-destructive/30 text-destructive hover:bg-destructive/10">
                  Refresh Page
                </Button>
              </div>
            )}
          </div>
        )}

        {deletedPages.length === 0 ? (
          <div className="text-center py-8 sm:py-12 px-4">
            <div className="mx-auto w-12 h-12 sm:w-16 sm:h-16 bg-muted/30 rounded-full flex items-center justify-center mb-4">
              <Icon name="Trash2" size={24} className="sm:h-8 sm:w-8 text-muted-foreground/60" />
            </div>
            <h3 className="text-base sm:text-lg font-semibold text-foreground mb-2">No recently deleted pages</h3>
            <p className="text-sm sm:text-base text-muted-foreground max-w-sm mx-auto leading-relaxed">Pages you delete will appear here for 30 days before being permanently removed.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {deletedPages.length} page{deletedPages.length !== 1 ? 's' : ''} found
                </p>
                <div className="hidden sm:block h-1 w-1 bg-muted-foreground/40 rounded-full"></div>
                <p className="text-sm text-muted-foreground">
                  Auto-delete in 30 days
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteAllPermanently}
                disabled={loading}
                className="w-full sm:w-auto shadow-sm"
              >
                <Icon name="Trash2" size={12} className="mr-1" />
                <span className="hidden xs:inline">Delete All Permanently</span>
                <span className="xs:hidden">Delete All</span>
              </Button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {deletedPages.map((page) => {
                const daysLeft = getDaysUntilPermanentDeletion(page.deletedAt)
                const isUrgent = daysLeft <= 7

                return (
                  <div
                    key={page.id}
                    className="group flex flex-col gap-4 p-4 sm:p-6 border-theme-medium rounded-xl hover:border-theme-strong hover:bg-muted/30 transition-all duration-200"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-col sm:flex-row sm:items-start gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <PillLink
                            href={`/${page.id}?preview=deleted`}
                            className="text-sm sm:text-base font-medium"
                          >
                            {page.title}
                          </PillLink>
                        </div>
                        <Badge
                          variant="secondary"
                          className="shrink-0 self-start text-xs text-muted-foreground border-muted-foreground/30 bg-transparent"
                        >
                          {page.isPublic ? "Public" : "Private"}
                        </Badge>
                      </div>
                      <div className="flex flex-col gap-2 text-xs sm:text-sm">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Icon name="Calendar" size={12} className="sm:h-3.5 sm:w-3.5" />
                          Deleted {formatDate(page.deletedAt)}
                        </span>
                        <span className={`flex items-center gap-1.5 font-medium ${
                          isUrgent
                            ? 'text-destructive'
                            : daysLeft <= 14
                              ? 'text-orange-600 dark:text-orange-400'
                              : 'text-muted-foreground'
                        }`}>
                          <div className={`h-2 w-2 rounded-full ${
                            isUrgent
                              ? 'bg-destructive'
                              : daysLeft <= 14
                                ? 'bg-orange-500'
                                : 'bg-muted-foreground/40'
                          }`}></div>
                          {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border/50 sm:border-t-0 sm:pt-0 sm:ml-4 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity duration-200">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => restorePage(page.id)}
                        disabled={restoring === page.id || permanentlyDeleting === page.id}
                        className="flex-1 sm:flex-none border-theme-medium hover:border-theme-strong hover:bg-muted/50 shadow-sm"
                      >
                        {restoring === page.id ? (
                          <Icon name="Loader" size={12} className="mr-2" />
                        ) : (
                          <Icon name="RotateCcw" size={12} className="mr-2" />
                        )}
                        <span className="hidden xs:inline">Restore</span>
                        <span className="xs:hidden">↻</span>
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => permanentlyDeletePage(page.id)}
                        disabled={restoring === page.id || permanentlyDeleting === page.id}
                        className="flex-1 sm:flex-none shadow-sm"
                      >
                        {permanentlyDeleting === page.id ? (
                          <Icon name="Loader" size={12} className="mr-2" />
                        ) : (
                          <Icon name="Trash2" size={12} className="mr-2" />
                        )}
                        <span className="hidden xs:inline">Delete Forever</span>
                        <span className="xs:hidden">Delete</span>
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}