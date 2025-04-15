"use client"

import React from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Settings, ChevronRight } from 'lucide-react'
import { IconButton } from './ui/icon-button'
import { cn } from '../lib/utils'
import { User } from '@/types'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/use-toast'
import { Button } from './ui/button'

interface AccountSwitcherModalProps {
  isOpen: boolean
  onClose: () => void
  accounts: User[]
  currentUser: User | null
  onSwitchAccount: (userId: string) => void
  onAddAccount?: () => void
}

export function AccountSwitcherModal({
  isOpen,
  onClose,
  accounts,
  currentUser,
  onSwitchAccount,
  onAddAccount
}: AccountSwitcherModalProps) {
  const router = useRouter()

  if (!isOpen) return null

  const handleAccountSettings = () => {
    router.push('/account')
    onClose()
  }

  // Navigate to home page after switching accounts
  const handleSwitchToAccount = (accountId: string) => {
    onSwitchAccount(accountId)
    onClose()
  }

  return (
    <>
      {/* Portal to ensure the modal is rendered at the root level */}
      {typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            pointerEvents: 'auto',
          }}
        >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-300"
        onClick={onClose}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
        data-state="open"
      />

      {/* Modal */}
      <div
        className="relative z-[10000] w-full max-w-md rounded-lg border bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] duration-300"
        style={{
          position: 'relative',
          maxWidth: '28rem',
          zIndex: 10000,
        }}
        data-state="open"
      >
        {/* Close button */}
        <IconButton
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="absolute right-4 top-4"
        >
          <X className="h-4 w-4" />
        </IconButton>

        {/* Header */}
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Switch Account</h2>
        </div>

        {/* Account list */}
        <div className="space-y-4 py-2 px-1">
          {accounts.map((account) => {
            const isCurrent = account.id === currentUser?.id;
            return (
              <div
                key={account.id}
                className={cn(
                  "flex items-center justify-between space-x-2 rounded-lg border p-3",
                  isCurrent && "border-blue-600 bg-blue-50 dark:bg-blue-950/30",
                  !isCurrent && "cursor-pointer hover:bg-muted/50 transition-colors"
                )}
                onClick={() => {
                  if (!isCurrent) {
                    handleSwitchToAccount(account.id);
                  }
                }}
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {account.username || "No username"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {account.email}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  {isCurrent ? (
                    <>
                      <div className="rounded-full bg-blue-600 px-2 py-1 text-xs text-white">
                        Current
                      </div>
                      <IconButton
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAccountSettings();
                        }}
                      >
                        <Settings className="h-4 w-4" />
                      </IconButton>
                    </>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
            );
          })}

          {onAddAccount && (
            <Button
              variant="outline"
              className="w-full mt-4 flex items-center justify-center gap-2"
              onClick={() => {
                onClose();
                onAddAccount();
              }}
            >
              <Plus className="h-4 w-4" />
              Add Account
            </Button>
          )}
        </div>
      </div>
        </div>,
        document.body
      )}
    </>
  )
}
