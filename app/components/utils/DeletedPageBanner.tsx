'use client'

import React, { useState } from 'react'
import { Button } from '../ui/button'
import { AlertTriangle, RotateCcw, Trash2, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface DeletedPageBannerProps {
  pageId: string
  pageTitle: string
  deletedAt: string
  daysLeft: number
  onRestore?: () => Promise<void>
  onPermanentDelete?: () => Promise<void>
  onClose?: () => void
}

export default function DeletedPageBanner({
  pageId,
  pageTitle,
  deletedAt,
  daysLeft,
  onRestore,
  onPermanentDelete,
  onClose
}: DeletedPageBannerProps) {
  const [isRestoring, setIsRestoring] = useState(false)
  const [isPermanentlyDeleting, setIsPermanentlyDeleting] = useState(false)
  const [isVisible, setIsVisible] = useState(true)
  const router = useRouter()

  const handleRestore = async () => {
    if (!onRestore) return
    
    try {
      setIsRestoring(true)
      await onRestore()
      // After successful restore, redirect to the restored page
      router.push(`/${pageId}`)
    } catch (error) {
      console.error('Error restoring page:', error)
      setIsRestoring(false)
    }
  }

  const handlePermanentDelete = async () => {
    if (!onPermanentDelete) return
    
    if (!confirm('Are you sure you want to permanently delete this page? This action cannot be undone.')) {
      return
    }
    
    try {
      setIsPermanentlyDeleting(true)
      await onPermanentDelete()
      // After successful deletion, redirect to settings/deleted
      router.push('/settings/deleted')
    } catch (error) {
      console.error('Error permanently deleting page:', error)
      setIsPermanentlyDeleting(false)
    }
  }

  const handleClose = () => {
    setIsVisible(false)
    if (onClose) {
      onClose()
    } else {
      // Default behavior: go back to deleted pages list
      router.push('/settings/deleted')
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return 'Unknown date'
    }
  }

  const isUrgent = daysLeft <= 7

  if (!isVisible) {
    return null
  }

  return (
    <div className="sticky top-0 z-50 w-full bg-destructive text-destructive-foreground border-b border-destructive/20 shadow-lg">
      <div className="container mx-auto px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
          {/* Warning info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <AlertTriangle className="h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="font-semibold">You're viewing a deleted page</span>
                <div className="flex items-center gap-2 text-sm text-destructive-foreground/80">
                  <span>Deleted {formatDate(deletedAt)}</span>
                  <span>•</span>
                  <span className={`font-medium ${isUrgent ? 'animate-pulse' : ''}`}>
                    {daysLeft} day{daysLeft !== 1 ? 's' : ''} until permanent deletion
                  </span>
                </div>
              </div>
              <p className="text-sm text-destructive-foreground/80 mt-1 hidden sm:block">
                This page will be permanently deleted after 30 days unless restored.
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRestore}
              disabled={isRestoring || isPermanentlyDeleting}
              className="bg-destructive-foreground text-destructive border-destructive-foreground hover:bg-destructive-foreground/90 flex-1 sm:flex-none"
            >
              {isRestoring ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-destructive mr-2"></div>
              ) : (
                <RotateCcw className="h-3 w-3 mr-2" />
              )}
              Restore
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handlePermanentDelete}
              disabled={isRestoring || isPermanentlyDeleting}
              className="bg-transparent text-destructive-foreground border-destructive-foreground/50 hover:bg-destructive-foreground/10 flex-1 sm:flex-none"
            >
              {isPermanentlyDeleting ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-destructive-foreground mr-2"></div>
              ) : (
                <Trash2 className="h-3 w-3 mr-2" />
              )}
              Delete Forever
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              disabled={isRestoring || isPermanentlyDeleting}
              className="text-destructive-foreground hover:bg-destructive-foreground/10 p-1 sm:flex-none self-end sm:self-auto"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}