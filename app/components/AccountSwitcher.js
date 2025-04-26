"use client";

import { useState, useMemo } from "react";
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
} from "./ui/dialog";
import { cn } from "../lib/utils";

export function AccountSwitcher() {
  const { accounts, currentAccount, switchAccount, isAtMaxAccounts, maxAccounts } = useMultiAccount();
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Sort accounts by last used (most recent first) - memoized to avoid unnecessary re-sorting
  const sortedAccounts = useMemo(() => {
    return [...accounts].sort((a, b) => {
      return new Date(b.lastUsed || 0) - new Date(a.lastUsed || 0);
    });
  }, [accounts]);

  const handleSwitchAccount = async (accountId) => {
    try {
      // Don't attempt to switch if it's already the current account
      if (currentAccount?.uid === accountId) {
        return;
      }

      const success = await switchAccount(accountId);
      if (success) {
        // Use router.refresh() to update the UI with the new account
        router.refresh();
      }
    } catch (error) {
      console.error("Error switching account:", error);
    }
  };

  const handleAddAccount = async () => {
    if (isAtMaxAccounts) {
      setIsDialogOpen(true);
      return;
    }

    try {
      // Sign out current user first
      await signOut(auth);
      // Then redirect to login page
      router.push("/auth/login");
    } catch (error) {
      console.error("Error signing out:", error);
      // Still try to redirect even if sign out fails
      router.push("/auth/login");
    }
  };

  return (
    <>
      <div className="mb-2">
        <h3 className="text-sm font-medium text-muted-foreground mb-2 px-2">Accounts</h3>
        <div className="space-y-1">
          {sortedAccounts.map((account) => {
            const isCurrentAccount = currentAccount?.uid === account.uid;
            const displayName = account.username || account.email?.split('@')[0] || 'User';

            return (
              <div key={account.uid} className="flex items-center">
                <Button
                  variant="ghost"
                  className={cn(
                    "flex-1 justify-start text-sm px-2 py-1.5 h-auto",
                    isCurrentAccount && "bg-accent text-accent-foreground"
                  )}
                  onClick={() => {
                    if (isCurrentAccount) {
                      // If clicking on current account, go to account settings
                      router.push('/account');
                    } else {
                      // Otherwise switch to that account
                      handleSwitchAccount(account.uid);
                    }
                  }}
                  disabled={!account.email} // Disable if account has no email
                >
                  <div className="flex items-center gap-2 w-full overflow-hidden">
                    <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium truncate",
                        !account.email && "text-muted-foreground"
                      )}>
                        {displayName}
                        {!account.email && " (Invalid)"}
                      </p>
                      {account.email ? (
                        <p className="text-xs text-muted-foreground truncate">{account.email}</p>
                      ) : (
                        <p className="text-xs text-destructive truncate">Missing email</p>
                      )}
                    </div>
                    {isCurrentAccount && (
                      <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </div>
                </Button>

                {/* Settings gear icon - only show for current account */}
                {isCurrentAccount && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 ml-1"
                    onClick={() => router.push('/account')}
                    title="Account settings"
                  >
                    <Settings className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </div>
            );
          })}

          <Button
            variant="ghost"
            className="w-full justify-start text-sm px-2 py-1.5 h-auto"
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
      </div>

      {/* Max accounts dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
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
              onClick={() => setIsDialogOpen(false)}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
