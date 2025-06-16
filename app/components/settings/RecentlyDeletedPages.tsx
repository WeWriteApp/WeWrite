'use client'

import React, { useState, useEffect } from 'react'
import { Button } from '../ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Trash2, RotateCcw, Calendar, AlertTriangle } from 'lucide-react'
import { useAuth } from '../../providers/AuthProvider'

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
  const { user } = useAuth()
  const [deletedPages, setDeletedPages] = useState<DeletedPage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [restoring, setRestoring] = useState<string | null>(null)
  const [permanentlyDeleting, setPermanentlyDeleting] = useState<string | null>(null)

  // Fetch recently deleted pages (within last 30 days)
  const fetchDeletedPages = async () => {
    if (!user?.uid) return

    try {
      setLoading(true)
      setError(null)

      // Dynamic import to match the pattern used elsewhere
      const { db } = await import('../../firebase/database')
      const { collection, query, where, orderBy, getDocs, Timestamp } = await import('firebase/firestore')

      // Calculate 30 days ago
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

      // Query for deleted pages within the last 30 days
      const deletedPagesQuery = query(
        collection(db, 'pages'),
        where('userId', '==', user.uid),
        where('deleted', '==', true),
        where('deletedAt', '>=', thirtyDaysAgo.toISOString()),
        orderBy('deletedAt', 'desc')
      )

      const snapshot = await getDocs(deletedPagesQuery)
      const pages: DeletedPage[] = []

      snapshot.forEach((doc) => {
        const data = doc.data()
        pages.push({
          id: doc.id,
          title: data.title || 'Untitled Page',
          deletedAt: data.deletedAt,
          deletedBy: data.deletedBy || data.userId,
          isPublic: data.isPublic || false,
          lastModified: data.lastModified,
          createdAt: data.createdAt
        })
      })

      setDeletedPages(pages)
    } catch (err) {
      console.error('Error fetching deleted pages:', err)
      setError('Failed to load recently deleted pages')
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

  useEffect(() => {
    fetchDeletedPages()
  }, [user?.uid])

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Recently Deleted Pages
          </CardTitle>
          <CardDescription>
            Pages deleted within the last 30 days
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600">Loading deleted pages...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trash2 className="h-5 w-5" />
          Recently Deleted Pages
        </CardTitle>
        <CardDescription>
          Pages deleted within the last 30 days. They will be permanently deleted after 30 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm">{error}</span>
            </div>
          </div>
        )}

        {deletedPages.length === 0 ? (
          <div className="text-center py-8">
            <Trash2 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No recently deleted pages</h3>
            <p className="text-gray-600">Pages you delete will appear here for 30 days before being permanently removed.</p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-600">
                {deletedPages.length} page{deletedPages.length !== 1 ? 's' : ''} found
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={deleteAllPermanently}
                disabled={loading}
              >
                Delete All Permanently
              </Button>
            </div>

            <div className="space-y-3">
              {deletedPages.map((page) => {
                const daysLeft = getDaysUntilPermanentDeletion(page.deletedAt)
                
                return (
                  <div
                    key={page.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-gray-900 truncate">
                          {page.title}
                        </h4>
                        <Badge variant={page.isPublic ? "default" : "secondary"}>
                          {page.isPublic ? "Public" : "Private"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Deleted {formatDate(page.deletedAt)}
                        </span>
                        <span className="text-orange-600 font-medium">
                          {daysLeft} day{daysLeft !== 1 ? 's' : ''} left
                        </span>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restorePage(page.id)}
                        disabled={restoring === page.id || permanentlyDeleting === page.id}
                      >
                        {restoring === page.id ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-900"></div>
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        Restore
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => permanentlyDeletePage(page.id)}
                        disabled={restoring === page.id || permanentlyDeleting === page.id}
                      >
                        {permanentlyDeleting === page.id ? (
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        ) : (
                          <Trash2 className="h-3 w-3" />
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
