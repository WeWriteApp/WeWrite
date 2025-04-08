"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMultiAccount } from "../providers/MultiAccountProvider";
import { Button } from "./ui/button";
import { auth } from "../firebase/config";
import { signOut } from "firebase/auth";
import { User, UserPlus, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import { cn } from "../lib/utils";

export function AccountSwitcherModal({ isOpen, onClose }) {
  const { accounts, currentAccount, switchAccount, isAtMaxAccounts, maxAccounts } = useMultiAccount();
  const router = useRouter();
  const [isMaxAccountsDialogOpen, setIsMaxAccountsDialogOpen] = useState(false);

  // Sort accounts by last used (most recent first)
  const sortedAccounts = [...accounts].sort((a, b) => {
    return new Date(b.lastUsed || 0) - new Date(a.lastUsed || 0);
  });

  const handleSwitchAccount = async (accountId) => {
    const success = await switchAccount(accountId);
    if (success) {
      router.refresh();
      onClose();
    }
  };

  const handleAddAccount = async () => {
    if (isAtMaxAccounts) {
      setIsMaxAccountsDialogOpen(true);
    } else {
      try {
        // Store current auth state in session storage
        if (currentAccount) {
          sessionStorage.setItem('returnToAccount', JSON.stringify({
            uid: currentAccount.uid,
            email: currentAccount.email
          }));
        }

        // Close the modal first
        onClose();

        // Navigate to login page with special parameter
        // Use window.location.href for a full page navigation to avoid Next.js router issues
        window.location.href = "/auth/login?mode=addAccount";
      } catch (error) {
        console.error("Error navigating to add account:", error);
        // Fallback to router.push if there's an error
        router.push("/auth/login?mode=addAccount");
      }
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Switch Account</DialogTitle>
            <DialogDescription>
              Select an account to switch to or add a new account
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-4">
            {sortedAccounts.map((account) => (
              <Button
                key={account.uid}
                variant="ghost"
                className={cn(
                  "w-full justify-start text-sm px-2 py-1.5 h-auto",
                  currentAccount?.uid === account.uid && "bg-accent text-accent-foreground"
                )}
                onClick={() => {
                  if (currentAccount?.uid === account.uid) {
                    // Navigate to account settings if clicking on current account
                    router.push('/account');
                    onClose();
                  } else {
                    // Switch to the selected account
                    handleSwitchAccount(account.uid);
                  }
                }}
              >
                <div className="flex items-center gap-2 w-full overflow-hidden">
                  <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {account.username || account.email.split('@')[0]}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {account.email}
                    </p>
                  </div>
                  {currentAccount?.uid === account.uid && (
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                  )}
                </div>
              </Button>
            ))}

            <Button
              variant="outline"
              className="w-full justify-start text-sm mt-4"
              onClick={handleAddAccount}
              disabled={isAtMaxAccounts}
            >
              <div className="flex items-center gap-2">
                <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserPlus className="h-3.5 w-3.5 text-primary" />
                </div>
                <span>Add account</span>
              </div>
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Max accounts dialog */}
      <Dialog open={isMaxAccountsDialogOpen} onOpenChange={setIsMaxAccountsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Account Limit Reached
            </DialogTitle>
            <DialogDescription>
              You can only log in to {maxAccounts} accounts at a time. To access another account, sign out of one first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-start">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsMaxAccountsDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
