"use client"

import * as React from "react"
import { Sun, Moon, Laptop } from "lucide-react"
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
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Laptop },
  ]

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-black/60 backdrop-blur-md z-[100] transition-opacity duration-300",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[280px] bg-background/95 backdrop-blur-md border-r z-[101] transition-transform duration-300 ease-in-out shadow-xl h-[100vh] overflow-y-auto",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full p-6">
          <div className="flex-1">
            <h2 className="text-xl font-bold mb-8 px-2 text-primary">WeWrite</h2>
            <div className="mb-8">
              <h3 className="text-sm font-medium text-muted-foreground mb-3 px-2">Theme</h3>
              {themeOptions.map((option) => {
                const Icon = option.icon
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
                    <Icon className="mr-2 h-4 w-4" />
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
              Log out
            </Button>
          </div>
        </div>
      </div>
    </>
  )
} 