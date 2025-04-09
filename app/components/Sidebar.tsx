"use client"

import * as React from "react"
import { X, Settings } from "lucide-react"
import { useRouter } from "next/navigation"
import { auth } from "../firebase/config"
import { signOut } from "firebase/auth"
import { cn } from "../lib/utils"
import { Button } from "./ui/button"
import dynamic from 'next/dynamic'
import { useMultiAccount } from "../providers/MultiAccountProvider"
import { SidebarNavigation } from "./SidebarNavigation"

// Dynamically import components with no SSR to avoid hydration issues
const AccountSwitcher = dynamic(
  () => import('./AccountSwitcher').then(mod => ({ default: mod.AccountSwitcher })),
  { ssr: false }
)

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter()

  // Listen for the custom closeSidebar event
  React.useEffect(() => {
    const handleCloseSidebar = () => {
      if (isOpen) {
        onClose();
      }
    };

    window.addEventListener('closeSidebar', handleCloseSidebar);

    return () => {
      window.removeEventListener('closeSidebar', handleCloseSidebar);
    };
  }, [isOpen, onClose]);

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push("/")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 z-[999] transition-opacity duration-300 min-h-screen w-screen",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[280px] bg-background border-theme-medium border-r-only z-[1000] transition-transform duration-300 ease-in-out shadow-lg h-[100vh] overflow-hidden",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full relative">
          {/* Header with Account Switcher - Fixed at top */}
          <div className="sticky top-0 z-10 bg-background p-6 pb-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-foreground">WeWrite</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 rounded-full hover:bg-muted"
                aria-label="Close sidebar"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {/* Account Switcher at the top */}
            <div className="mb-4">
              <AccountSwitcher />
            </div>
          </div>

          {/* Scrollable content - Single stack */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-6 pb-6 scrollbar-hide">
            <SidebarNavigation />
          </div>
        </div>
      </div>
    </>
  )
}
