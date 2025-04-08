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
          "fixed top-0 left-0 bottom-0 w-[280px] bg-background border-theme-medium border-r-only z-[1000] transition-transform duration-300 ease-in-out shadow-lg h-[100vh] overflow-y-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full p-6 pb-24">
          <div className="flex items-center justify-between mb-6">
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

          <div className="flex-1">
            {/* New Multi-level Navigation */}
            <SidebarNavigation />
          </div>

          {/* Account Switcher and Settings buttons at bottom */}
          <div className="mt-auto pt-4 border-t border-border">
            {/* Account Switcher */}
            <AccountSwitcher />

            {/* Settings Button */}
            <Button
              variant="ghost"
              className="w-full justify-start text-foreground hover:bg-accent mb-2"
              onClick={() => router.push('/account')}
            >
              <Settings className="size-4 mr-2" />
              <span>Settings</span>
            </Button>

            {/* Logout Button */}
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width="24"
                height="24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-5 w-5 mr-2 text-destructive"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                <polyline points="16 17 21 12 16 7"></polyline>
                <line x1="21" y1="12" x2="9" y2="12"></line>
              </svg>
              <span>Log out</span>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
