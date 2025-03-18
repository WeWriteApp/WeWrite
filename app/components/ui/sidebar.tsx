"use client"

import * as React from "react"
import { X, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { auth } from "../../firebase/config"
import { signOut } from "firebase/auth"
import { cn } from "../../lib/utils"
import Button from "../Button"
import { useTheme } from "next-themes"

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const router = useRouter()
  const { theme, setTheme } = useTheme()

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push("/auth/login")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

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

  // Force icon display
  React.useEffect(() => {
    const loadIcons = async () => {
      // Force Lucide to initialize icons
      const icons = document.querySelectorAll('.lucide, [data-lucide]');
      icons.forEach(icon => {
        // Ensure icon is visible
        if (icon instanceof HTMLElement) {
          icon.style.display = 'inline-block';
          icon.style.color = 'currentColor';
        }
      });
    };
    
    if (isOpen) {
      loadIcons();
    }
  }, [isOpen]);

  return (
    <>
      {/* Backdrop - increased z-index to be on top of everything */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 backdrop-blur-md z-[999] transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[280px] bg-background/95 backdrop-blur-md border-r z-[1000] transition-transform duration-300 ease-in-out shadow-xl h-[100vh] overflow-y-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-primary">WeWrite</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full hover:bg-accent"
              aria-label="Close sidebar"
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
                className="h-5 w-5 text-foreground"
              >
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </Button>
          </div>
          
          <div className="flex-1">
            <div className="mb-8">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 px-2">Theme</h3>
              {themeOptions.map((option) => {
                return (
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
                )
              })}
            </div>
          </div>
          
          {/* Logout button at bottom */}
          <div className="mt-auto pt-4 border-t border-border">
            <Button
              variant="ghost"
              className="w-full justify-center text-destructive hover:text-destructive hover:bg-destructive/10 py-3"
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
              Log out
            </Button>
          </div>
        </div>
      </div>
    </>
  )
} 