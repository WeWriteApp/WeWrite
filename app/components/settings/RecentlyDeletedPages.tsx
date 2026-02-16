'use client'

import React, { useState, useEffect } from 'react'
import { Icon } from '@/components/ui/Icon';
import { Button } from '../ui/button'
import { Card } from '../ui/card'
import { ErrorDisplay } from '../ui/error-display'
import { useAuth } from '../../providers/AuthProvider';
import PillLink from '../utils/PillLink'
import EmptyState from '../ui/EmptyState'

interface DeletedPage {
  id: string
  title: string
  deletedAt: string
  deletedBy: string
  lastModified: string
  createdAt: string
}

export default function RecentlyDeletedPages() {
  const { user } = useAuth();
  const [deletedPages, setDeletedPages] = useState<DeletedPage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<{ message: string; error?: Error } | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [permanentlyDeleting, setPermanentlyDeleting] = useState<string | null>(null)

  // Fetch recently deleted pages (within last 30 days)
  const fetchDeletedPages = async () => {
    if (!user?.uid) return

    try {
      setLoading(true)
      setError(null)


      // Call API endpoint to get deleted pages
      // Add cache buster to ensure fresh data (browser caches can be 15min stale)
      const cacheBuster = Date.now();
      const response = await fetch(`/api/pages?userId=${user.uid}&includeDeleted=true&orderBy=deletedAt&orderDirection=desc&limit=100&_cb=${cacheBuster}`)

      if (!response.ok) {
        throw new Error(`Failed to fetch deleted pages: ${response.status}`)
      }

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch deleted pages')
      }

      // Handle different response formats (result.data.pages or result.pages)
      const pagesData = result.data?.pages || result.pages || []

      const pages: DeletedPage[] = pagesData
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
          lastModified: page.lastModified,
          createdAt: page.createdAt
        }))

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

      setError({
        message: errorMessage,
        error: err instanceof Error ? err : new Error(String(err))
      })
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

      setError({
        message: errorMessage,
        error: err instanceof Error ? err : new Error(String(err))
      })
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

      setError({
        message: errorMessage,
        error: err instanceof Error ? err : new Error(String(err))
      })
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
      setError({
        message: 'Failed to delete all pages',
        error: err instanceof Error ? err : new Error(String(err))
      })
    } finally {
      setLoading(false)
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

  useEffect(() => {
    fetchDeletedPages()
  }, [user?.uid])

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="text-center py-8">
          <Icon name="Loader" size={28} className="mx-auto" />
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {error && (
        <ErrorDisplay
          message={error.message}
          error={error.error}
          onRetry={fetchDeletedPages}
          className="mb-4"
        />
      )}

      {deletedPages.length === 0 ? (
        <EmptyState
          icon="Trash2"
          title="No recently deleted pages"
          description="Pages you delete will appear here for 30 days before being permanently removed."
        />
      ) : (
        <>
          {/* Header info and delete all button */}
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-muted-foreground">
              {deletedPages.length} page{deletedPages.length !== 1 ? 's' : ''}
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={deleteAllPermanently}
              disabled={loading}
              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2"
            >
              <Icon name="Trash2" size={14} className="mr-1.5" />
              Delete All
            </Button>
          </div>

          {/* Page cards */}
          <div className="space-y-3">
            {deletedPages.map((page) => {
              const daysLeft = getDaysUntilPermanentDeletion(page.deletedAt)
              const isUrgent = daysLeft <= 7

              return (
                <Card key={page.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <PillLink
                      href={`/${page.id}?preview=deleted`}
                      className="text-sm font-medium"
                    >
                      {page.title}
                    </PillLink>
                    <span className={`text-xs font-medium shrink-0 ${
                      isUrgent
                        ? 'text-destructive'
                        : daysLeft <= 14
                          ? 'text-orange-600 dark:text-orange-400'
                          : 'text-muted-foreground'
                    }`}>
                      {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => restorePage(page.id)}
                      disabled={restoring === page.id || permanentlyDeleting === page.id}
                      className="flex-1"
                    >
                      {restoring === page.id ? (
                        <Icon name="Loader" size={14} className="mr-1.5" />
                      ) : (
                        <Icon name="RotateCcw" size={14} className="mr-1.5" />
                      )}
                      Restore
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => permanentlyDeletePage(page.id)}
                      disabled={restoring === page.id || permanentlyDeleting === page.id}
                      className="flex-1"
                    >
                      {permanentlyDeleting === page.id ? (
                        <Icon name="Loader" size={14} className="mr-1.5" />
                      ) : (
                        <Icon name="Trash2" size={14} className="mr-1.5" />
                      )}
                      Delete
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
