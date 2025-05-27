"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { LogOut, User, Settings } from "lucide-react"
import { auth } from "../../firebase/config"
import { signOut as firebaseSignOut } from "firebase/auth"
import { useAuth } from "../../providers/AuthProvider"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu"
import { Button } from "./button"

export function UserMenu() {
  const router = useRouter()
  const { user } = useAuth()

  const handleLogout = async () => {
    try {
      // Check if there are multiple accounts to determine logout behavior
      const savedAccountsJson = localStorage.getItem('savedAccounts');
      let hasMultipleAccounts = false;

      if (savedAccountsJson) {
        try {
          const savedAccounts = JSON.parse(savedAccountsJson);
          hasMultipleAccounts = savedAccounts.length > 1;
        } catch (e) {
          console.error('Error parsing saved accounts:', e);
        }
      }

      // Import the enhanced logout function
      const { logoutUser } = await import('../../firebase/auth');

      // If multiple accounts, try to return to previous account
      // Otherwise, do a normal logout
      const result = await logoutUser(false, hasMultipleAccounts);

      if (!result.returnedToPrevious) {
        // If we didn't return to a previous account, redirect to home
        router.push("/");
      }
      // If we returned to previous account, the redirect is handled by logoutUser
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
        <DropdownMenuItem onClick={() => router.push('/account')}>
          <Settings className="mr-2 h-4 w-4" />
          <span>Account Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}