"use client";

import React from "react";
import { Globe, Lock, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger} from "../ui/dropdown-menu";
import { Button } from "../ui/button";

/**
 * VisibilityDropdown Component
 *
 * A dropdown menu for toggling between public and private visibility states
 * with clear labels and explanatory text.
 *
 * @param {Object} props
 * @param {boolean} props.isPublic - Current visibility state
 * @param {Function} props.onVisibilityChange - Function to call when visibility changes
 * @param {boolean} props.disabled - Whether the dropdown is disabled
 * @param {string} props.className - Additional CSS classes
 */
export default function VisibilityDropdown({
  isPublic,
  onVisibilityChange,
  disabled = false,
  className = ""}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted border-theme-medium hover-border-medium transition-colors ${className}`}
        >
          {isPublic ? (
            <Globe className="h-4 w-4 text-green-500" />
          ) : (
            <Lock className="h-4 w-4 text-amber-500" />
          )}
          <span className="text-sm font-medium">
            {isPublic ? "Public Group" : "Private Group"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onClick={() => onVisibilityChange(true)}
          className="flex items-center gap-2 py-2"
        >
          <div className="flex items-center gap-2 flex-1">
            <Globe className="h-4 w-4 text-green-500 flex-shrink-0" />
            <div className="flex flex-col">
              <span className="font-medium">Public</span>
              <span className="text-xs text-muted-foreground">
                Anyone can find and view this group
              </span>
            </div>
          </div>
          {isPublic && <Check className="h-4 w-4 ml-2" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onVisibilityChange(false)}
          className="flex items-center gap-2 py-2"
        >
          <div className="flex items-center gap-2 flex-1">
            <Lock className="h-4 w-4 text-amber-500 flex-shrink-0" />
            <div className="flex flex-col">
              <span className="font-medium">Private</span>
              <span className="text-xs text-muted-foreground">
                Only members can access this group
              </span>
            </div>
          </div>
          {!isPublic && <Check className="h-4 w-4 ml-2" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}