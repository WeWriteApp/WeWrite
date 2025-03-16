"use client"

import * as React from "react"
import { LogOut, Moon } from "lucide-react"
import { useRouter } from "next/navigation"
import { auth } from "@/firebase/config"
import { signOut } from "firebase/auth"
import { cn } from "@/lib/utils"
import Button from "../Button"

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
  onThemeClick: () => void
}

export function Sidebar({ isOpen, onClose, onThemeClick }: SidebarProps) {
  const router = useRouter()

  const handleLogout = async () => {
    try {
      await signOut(auth)
      router.push("/auth/login")
    } catch (error) {
      console.error("Error signing out:", error)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 bg-background/80 backdrop-blur-sm z-50 transition-opacity",
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div
        className={cn(
          "fixed top-0 left-0 bottom-0 w-[250px] bg-background border-r z-50 transition-transform duration-200 ease-in-out",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full p-4">
          <div className="flex-1">
            <Button
              variant="ghost"
              className="w-full justify-start mb-2"
              onClick={onThemeClick}
            >
              <Moon className="mr-2 h-4 w-4" />
              Change theme
            </Button>
          </div>
          <Button
            variant="ghost"
            className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50/10"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      </div>
    </>
  )
} 