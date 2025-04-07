"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMultiAccount } from "../providers/MultiAccountProvider";
import { Button } from "./ui/button";
import { auth } from "../firebase/config";
import { signOut } from "firebase/auth";
import { User, LogOut, UserPlus, AlertCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
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

  // Sort accounts by last used (most recent first)
  const sortedAccounts = [...accounts].sort((a, b) => {
    return new Date(b.lastUsed || 0) - new Date(a.lastUsed || 0);
  });

  const handleSwitchAccount = async (accountId) => {
    const success = await switchAccount(accountId);
    if (success) {
      router.refresh();
    }
  };

  const handleAddAccount = async () => {
    if (isAtMaxAccounts) {
      setIsDialogOpen(true);
    } else {
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
    }
  };

  return (
    <>
      <div className="mb-2">
        <h3 className="text-sm font-medium text-muted-foreground mb-2 px-2">Switch account</h3>
        <div className="space-y-1">
          {sortedAccounts.map((account) => (
            <Button
              key={account.uid}
              variant="ghost"
              className={cn(
                "w-full justify-start text-sm px-2 py-1.5 h-auto",
                currentAccount?.uid === account.uid && "bg-accent text-accent-foreground"
              )}
              onClick={() => currentAccount?.uid !== account.uid && handleSwitchAccount(account.uid)}
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
