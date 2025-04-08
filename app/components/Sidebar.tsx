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
          "fixed top-0 left-0 bottom-0 w-[280px] bg-background border-theme-medium border-r-only z-[1000] transition-transform duration-300 ease-in-out shadow-lg h-[100vh] overflow-y-auto pb-24",
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

          {/* Account Switcher at bottom */}
          <div className="mt-auto pt-4 border-t border-border">
            {/* Account Switcher */}
            <AccountSwitcher />
          </div>
        </div>
      </div>
    </>
  )
}
