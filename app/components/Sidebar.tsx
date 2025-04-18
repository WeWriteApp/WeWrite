"use client"

import * as React from "react"
import { X } from "lucide-react"
import { useRouter } from "next/navigation"
import { auth } from "../firebase/config"
import { signOut } from "firebase/auth"
import { cn } from "../lib/utils"
import { Button } from "./ui/button"
import { useTheme } from "next-themes"
import { SimpleAccountSwitcher } from "./SimpleAccountSwitcher"

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  // Logout functionality moved to account settings page

  const themeOptions = [
    {
      value: "light",
      label: "Light",
      icon: (
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
          className="mr-2 h-5 w-5 text-foreground"
        >
          <circle cx="12" cy="12" r="5"></circle>
          <line x1="12" y1="1" x2="12" y2="3"></line>
          <line x1="12" y1="21" x2="12" y2="23"></line>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
          <line x1="1" y1="12" x2="3" y2="12"></line>
          <line x1="21" y1="12" x2="23" y2="12"></line>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        </svg>
      )
    },
    {
      value: "dark",
      label: "Dark",
      icon: (
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
          className="mr-2 h-5 w-5 text-foreground"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        </svg>
      )
    },
    {
      value: "system",
      label: "System",
      icon: (
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
          className="mr-2 h-5 w-5 text-foreground"
        >
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
      )
    }
  ]

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
          "fixed top-0 left-0 bottom-0 w-[280px] bg-background border-r border-border z-[1000] transition-transform duration-300 ease-in-out shadow-lg h-[100vh] overflow-y-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full p-6">
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

          <div className="flex flex-col space-y-6">
            {/* Account Switcher */}
            <div className="mb-2">
              <SimpleAccountSwitcher />
            </div>

            {/* Theme Options */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 px-2">Theme</h3>
              {themeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={cn(
                    "flex items-center w-full px-3 py-2.5 text-sm rounded-md transition-colors mb-1",
                    "hover:bg-accent hover:text-accent-foreground",
                    theme === option.value && "bg-accent text-accent-foreground"
                  )}
                >
                  <div className="flex items-center justify-center w-5 h-5 rounded-full border mr-2">
                    {theme === option.value && (
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                    )}
                  </div>
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>

            {/* Additional sidebar items can be added here in the future */}
          </div>
        </div>
      </div>
    </>
  )
}