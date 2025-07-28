"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LogOut, User, Settings } from "lucide-react"
import { logoutUser } from "../../firebase/auth"
import { useAuth } from '../../providers/AuthProvider';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger} from "./dropdown-menu"
import { Button } from "./button"

export function UserMenu() {
  const router = useRouter()
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    try {
      // Use the auth signOut method (it handles redirection)
      await signOut();
    } catch (error) {
      console.error("Error signing out:", error)
      // Fallback to home page on error
      router.push("/");
    }
  }

  if (!user) {
    return null
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 px-0">
          <User className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push('/settings')}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}