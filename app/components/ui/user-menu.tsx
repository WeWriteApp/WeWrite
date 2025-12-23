"use client"

import * as React from "react"
import { Icon } from '@/components/ui/Icon';
import { useRouter } from "next/navigation"
// REMOVED: Direct Firebase imports - now using API endpoints for cost optimization
import { userProfileApi } from '../../utils/apiClient';
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
          <Icon name="User" size={16} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => router.push('/settings')}>
          <Icon name="Settings" size={16} className="mr-2" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleLogout}>
          <Icon name="LogOut" size={16} className="mr-2" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}