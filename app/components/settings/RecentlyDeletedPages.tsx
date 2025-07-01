'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Trash2, RotateCcw, Calendar, AlertTriangle } from 'lucide-react'
import { useCurrentAccount } from '../../providers/CurrentAccountProvider';
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
  const { currentAccount } = useCurrentAccount();
  const [deletedPages, setDeletedPages] = useState<DeletedPage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [permanentlyDeleting, setPermanentlyDeleting] = useState<string | null>(null)

  // Fetch recently deleted pages (within last 30 days)
  const fetchDeletedPages = async () => {
    if (!currentAccount?.uid) return

    try {
      setLoading(true)
      setError(null)

      // Dynamic import to match the pattern used elsewhere
      const { db } = await import('../../firebase/database')
      const { collection, query, where, orderBy, getDocs, Timestamp } = await import('firebase/firestore')

      // Calculate 30 days ago
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      // FIXED: Improved query with better error handling
      // Query for deleted pages within the last 30 days
      const deletedPagesQuery = query(
        collection(db, 'pages'),
        where('userId', '==', currentAccount.uid),
        where('deleted', '==', true),
        where('deletedAt', '>=', thirtyDaysAgo.toISOString()),
        orderBy('deletedAt', 'desc')
      )

      console.log('Fetching deleted pages for user:', currentAccount.uid)
      const snapshot = await getDocs(deletedPagesQuery)
      const pages: DeletedPage[] = []

      snapshot.forEach((doc) => {
        const data = doc.data()
        // Validate that the page has required fields
        if (data.deletedAt && data.deleted === true) {
          pages.push({
            id: doc.id,
            title: data.title || 'Untitled Page',
            deletedAt: data.deletedAt,
            deletedBy: data.deletedBy || data.userId,
            isPublic: data.isPublic || false,
            lastModified: data.lastModified,
            createdAt: data.createdAt
          })
        }
      })

      console.log(`Found ${pages.length} deleted pages`)
      setDeletedPages(pages)
    } catch (err) {
      console.error('Error fetching deleted pages:', err)

      // Provide more specific error messages
      let errorMessage = 'Failed to load recently deleted pages'
      if (err instanceof Error) {
        if (err.message.includes('index')) {
          errorMessage = 'Database index is being built. Please try again in a few minutes.'
        } else if (err.message.includes('permission')) {
          errorMessage = 'Permission denied. Please check your account settings.'
        } else if (err.message.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.'
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

      // Dynamic import
      const { updatePage } = await import('../../firebase/database')

      // Remove the deleted flag and deletedAt timestamp
      const success = await updatePage(pageId, {
        deleted: false,
        deletedAt: null,
        deletedBy: null,
        lastModified: new Date().toISOString()
      })

      if (success) {
        // Remove from the deleted pages list
        setDeletedPages(prev => prev.filter(page => page.id !== pageId))
      } else {
        setError('Failed to restore page')
      }
    } catch (err) {
      console.error('Error restoring page:', err)
      setError('Failed to restore page')
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

      // Dynamic import
      const { db } = await import('../../firebase/database')
      const { doc, deleteDoc } = await import('firebase/firestore')

      // Actually delete the document from Firestore
      await deleteDoc(doc(db, 'pages', pageId))

      // Remove from the deleted pages list
      setDeletedPages(prev => prev.filter(page => page.id !== pageId))
    } catch (err) {
      console.error('Error permanently deleting page:', err)
      setError('Failed to permanently delete page')
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

      // Dynamic import
      const { db } = await import('../../firebase/database')
      const { doc, deleteDoc } = await import('firebase/firestore')

      // Delete all pages
      await Promise.all(
        deletedPages.map(page => deleteDoc(doc(db, 'pages', page.id)))
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
  }, [currentAccount?.uid])

  if (loading) {
    return (
      <Card className="wewrite-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-foreground">
            <Trash2 className="h-5 w-5 text-muted-foreground" />
            Recently Deleted Pages
          </CardTitle>
          <CardDescription>
            Pages deleted within the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Loading deleted pages...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="wewrite-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <Trash2 className="h-5 w-5 text-muted-foreground" />
          Recently Deleted Pages
        </CardTitle>
        <CardDescription>
          Pages deleted within the last 30 days. They will be permanently deleted after 30 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2 text-destructive mb-3">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">{error}</span>
            </div>
            {retryCount < 3 && (
              <Button onClick={retryFetch} variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10">
                Try Again {retryCount > 0 && `(${retryCount}/3)`}
              </Button>
            )}
            {retryCount >= 3 && (
              <div className="space-y-2">
                <p className="text-xs text-destructive/80">
                  Multiple attempts failed. Please try refreshing the page or contact support.
                </p>
                <Button onClick={() => window.location.reload()} variant="outline" size="sm" className="border-destructive/30 text-destructive hover:bg-destructive/10">
                  Refresh Page
                </Button>
              </div>
            )}
          </div>
        )}

        {deletedPages.length === 0 ? (
          <div className="text-center py-12">
            <div className="mx-auto w-16 h-16 bg-muted/30 rounded-full flex items-center justify-center mb-4">
              <Trash2 className="h-8 w-8 text-muted-foreground/60" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No recently deleted pages</h3>
            <p className="text-muted-foreground max-w-sm mx-auto">Pages you delete will appear here for 30 days before being permanently removed.</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <p className="text-sm text-muted-foreground">
                  {deletedPages.length} page{deletedPages.length !== 1 ? 's' : ''} found
                </p>
                <div className="h-1 w-1 bg-muted-foreground/40 rounded-full"></div>
                <p className="text-sm text-muted-foreground">
                  Auto-delete in 30 days
                </p>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteAllPermanently}
                disabled={loading}
                className="shadow-sm"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete All Permanently
              </Button>
            </div>

            <div className="space-y-3">
              {deletedPages.map((page) => {
                const daysLeft = getDaysUntilPermanentDeletion(page.deletedAt)
                const isUrgent = daysLeft <= 7

                return (
                  <div
                    key={page.id}
                    className="group flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-6 border-theme-medium rounded-xl hover:border-theme-strong hover:bg-muted/30 transition-all duration-200"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start sm:items-center gap-3 mb-3">
                        <div className="flex-1 min-w-0">
                          <PillLink
                            href={`/${page.id}?preview=deleted`}
                            className="text-base"
                          >
                            {page.title}
                          </PillLink>
                        </div>
                        <Badge
                          variant="outline"
                          className="shrink-0 text-muted-foreground border-muted-foreground/30 bg-transparent"
                        >
                          {page.isPublic ? "Public" : "Private"}
                        </Badge>
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
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

                    <div className="flex flex-col sm:flex-row gap-2 sm:ml-4 opacity-100 sm:opacity-60 sm:group-hover:opacity-100 transition-opacity duration-200">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restorePage(page.id)}
                        disabled={restoring === page.id || permanentlyDeleting === page.id}
                        className="flex-1 sm:flex-none border-theme-medium hover:border-theme-strong hover:bg-muted/50 shadow-sm"
                      >
                        {restoring === page.id ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary mr-2"></div>
                        ) : (
                          <RotateCcw className="h-3 w-3 mr-2" />
                        )}
                        Restore
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => permanentlyDeletePage(page.id)}
                        disabled={restoring === page.id || permanentlyDeleting === page.id}
                        className="flex-1 sm:flex-none shadow-sm"
                      >
                        {permanentlyDeleting === page.id ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                        ) : (
                          <Trash2 className="h-3 w-3 mr-2" />
                        )}
                        Delete Forever
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