"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMultiAccount } from "../providers/MultiAccountProvider";
import { Button } from "./ui/button";
import { auth } from "../firebase/config";
import { signOut } from "firebase/auth";
import { User, UserPlus, AlertCircle, Settings } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogPortal,
  DialogOverlay,
} from "./ui/dialog";
import "../styles/modal-animations.css";
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
        // First, sign out the current user
        await signOut(auth);

        // Store current auth state in session storage
        if (currentAccount) {
          sessionStorage.setItem('returnToAccount', JSON.stringify({
            uid: currentAccount.uid,
            email: currentAccount.email
          }));
        }

        // Close the modal first
        onClose();

        // Add a flag to localStorage to indicate we're adding a new account
        localStorage.setItem('addingNewAccount', 'true');

        // Force a full page navigation to the login page
        window.location.href = "/auth/login?mode=addAccount";

        // Log for debugging
        console.log("Navigating to login page for adding a new account");
      } catch (error) {
        console.error("Error navigating to add account:", error);
        // Show an error message
        alert("There was an error signing out. Please try again.");
      }
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogPortal>
          <DialogOverlay className="support-modal-overlay" />
          <DialogContent className="sm:max-w-md mx-auto rounded-lg overflow-hidden border-border dark:border-border support-modal">
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
                  "w-full justify-start text-sm px-2 py-1.5 h-auto hover:bg-accent rounded-md",
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
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium truncate">
                      {account.username || account.email.split('@')[0]}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {account.email}
                    </p>
                  </div>
                  <Settings className="h-4 w-4 text-muted-foreground flex-shrink-0 mr-1" />
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
            >
              <div className="flex items-center gap-2 w-full">
                <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                  <UserPlus className="h-3.5 w-3.5 text-primary" />
                </div>
                <span className="flex-grow">Add account</span>
                {isAtMaxAccounts && (
                  <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                    {accounts.length}/{maxAccounts}
                  </span>
                )}
              </div>
            </Button>
          </div>
        </DialogContent>
        </DialogPortal>
      </Dialog>

      {/* Max accounts dialog */}
      <Dialog open={isMaxAccountsDialogOpen} onOpenChange={setIsMaxAccountsDialogOpen}>
        <DialogPortal>
          <DialogOverlay className="support-modal-overlay" />
          <DialogContent className="sm:max-w-md mx-auto rounded-lg overflow-hidden border-border dark:border-border support-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Account Limit Reached
            </DialogTitle>
            <DialogDescription>
              You can only log in to {maxAccounts} accounts at a time. To access another account, sign out of one first.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <div className="space-y-2 mb-4">
              <h4 className="text-sm font-medium">Your current accounts:</h4>
              {sortedAccounts.map((account) => (
                <div key={account.uid} className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
                  <div className="flex items-center gap-2">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <span className="text-sm truncate max-w-[180px]">{account.email}</span>
                  </div>
                  {currentAccount?.uid === account.uid && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Current</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button
              type="button"
              variant="default"
              onClick={() => {
                setIsMaxAccountsDialogOpen(false);
                router.push('/account?action=logout');
              }}
              className="w-full"
            >
              Go to Account Settings
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsMaxAccountsDialogOpen(false)}
              className="w-full"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
        </DialogPortal>
      </Dialog>
    </>
  );
}
