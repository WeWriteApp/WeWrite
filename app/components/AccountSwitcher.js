"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMultiAccount } from "../providers/MultiAccountProvider";
import { Button } from "./ui/button";
import { User, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";
import { AccountSwitcherModal } from "./AccountSwitcherModal";

export function AccountSwitcher() {
  const { currentAccount } = useMultiAccount();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <div className="mb-2">
        <h3 className="text-sm font-medium text-muted-foreground mb-2 px-2">Account</h3>
        <Button
          variant="ghost"
          className="w-full justify-between text-sm px-2 py-1.5 h-auto"
          onClick={() => setIsModalOpen(true)}
        >
          <div className="flex items-center gap-2 w-full overflow-hidden">
            <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">
                {currentAccount?.username || currentAccount?.email?.split('@')[0] || 'Account'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {currentAccount?.email || ''}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </Button>
      </div>

      {/* Account Switcher Modal */}
      <AccountSwitcherModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
}
