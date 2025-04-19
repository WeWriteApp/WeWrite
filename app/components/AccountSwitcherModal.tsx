"use client"

import React from 'react'
import { createPortal } from 'react-dom'
import { X, Plus, Settings, ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'
import { User } from '@/types'
import { useRouter } from 'next/navigation'
import { Button } from './ui/button'
import Modal from './ui/modal'

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

  const handleAccountSettings = () => {
    router.push('/account')
    onClose()
  }

  // Navigate to home page after switching accounts
  const handleSwitchToAccount = (accountId: string) => {
    // Just call the parent's onSwitchAccount function and close the modal
    // The parent component will handle the navigation
    onSwitchAccount(accountId)
    onClose()
  }

  // Use createPortal to render the modal at the document body level
  // This ensures it's centered in the viewport and not constrained by parent elements
  return typeof document !== 'undefined' ? createPortal(
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Switch Account"
      className="max-w-md"
    >

        {/* Account list */}
        <div className="space-y-4 py-2 px-1">
          {accounts.map((account) => {
            const isCurrent = account.id === currentUser?.id;
            return (
              <div
                key={account.id}
                className={cn(
                  "flex items-center justify-between rounded-lg border border-border dark:border-border p-3 overflow-hidden cursor-pointer hover:bg-muted/50 transition-colors",
                  isCurrent && "border-blue-600 bg-blue-50 dark:bg-blue-950/30"
                )}
                onClick={() => {
                  if (isCurrent) {
                    // If it's the current account, go to account settings
                    handleAccountSettings();
                  } else {
                    // Otherwise switch to that account
                    handleSwitchToAccount(account.id);
                  }
                }}
              >
                <div className="space-y-1 min-w-0 flex-1 mr-2 text-left">
                  <p className="text-sm font-medium leading-none truncate text-left">
                    {account.username || "No username"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate text-left">
                    {account.email}
                  </p>
                </div>
                <div className="flex items-center space-x-2 flex-shrink-0">
                  {isCurrent ? (
                    <>
                      <div className="rounded-full bg-blue-600 px-2 py-1 text-xs text-white">
                        Current
                      </div>
                      <Settings className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </>
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                </div>
              </div>
            );
          })}

          {onAddAccount && (
            <div className="w-full mt-4">
              <Button
                variant="outline"
                className="w-full flex items-center justify-center gap-2"
                onClick={(e) => {
                  // Prevent event propagation
                  e.preventDefault();
                  e.stopPropagation();

                  // Close modal first
                  onClose();

                  // Call the add account function directly
                  if (onAddAccount) {
                    onAddAccount();
                  }
                }}
              >
                <Plus className="h-4 w-4" />
                Add Account
              </Button>
            </div>
          )}
        </div>
    </Modal>,
    document.body
  ) : null
}
