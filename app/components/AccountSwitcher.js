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
  const router = useRouter();

  return (
    <>
      <div className="mb-1">
        <h3 className="text-sm font-medium text-muted-foreground mb-1 px-2">Account</h3>
        <Button
          variant="ghost"
          className="w-full justify-between text-sm px-2 py-1.5 h-auto hover:bg-accent rounded-md"
          onClick={() => setIsModalOpen(true)}
        >
          <div className="flex items-center gap-2 w-full overflow-hidden">
            <div className="flex-1 min-w-0 text-left">
              <p className="text-sm font-medium truncate">
                {currentAccount?.username || currentAccount?.email?.split('@')[0] || 'Account'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {currentAccount?.email || ''}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
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
