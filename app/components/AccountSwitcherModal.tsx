"use client"

import React from 'react'
import { X, Plus, Settings } from 'lucide-react'
import { IconButton } from './ui/icon-button'
import { cn } from '../lib/utils'
import { User } from '@/types'
import { useRouter } from 'next/navigation'
import { useToast } from './ui/use-toast'
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
  const { toast } = useToast()

  if (!isOpen) return null

  const handleAccountSettings = () => {
    router.push('/account/settings')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-50 w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
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
          {accounts.map((account) => (
            <div
              key={account.id}
              className={cn(
                "flex items-center justify-between space-x-2 rounded-lg border p-3",
                account.id === currentUser?.id && "border-blue-600 bg-blue-50 dark:bg-blue-950/30"
              )}
            >
              <div className="flex items-center space-x-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  {account.username?.charAt(0).toUpperCase() || "?"}
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {account.username || "No username"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {account.email}
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {account.id === currentUser?.id ? (
                  <>
                    <div className="rounded-full bg-blue-600 px-2 py-1 text-xs text-white">
                      Current
                    </div>
                    <IconButton
                      variant="ghost"
                      size="sm"
                      onClick={handleAccountSettings}
                    >
                      <Settings className="h-4 w-4" />
                    </IconButton>
                  </>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSwitchAccount(account.id)}
                  >
                    Switch
                  </Button>
                )}
              </div>
            </div>
          ))}

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
    </div>
  )
}
