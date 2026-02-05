"use client";

import React from "react";
import { Icon } from "@/components/ui/Icon";
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
 * @param {'page' | 'group'} props.mode - Context mode (page or group)
 * @param {boolean} props.compact - Show compact version (icon only)
 */
export default function VisibilityDropdown({
  isPublic,
  onVisibilityChange,
  disabled = false,
  className = "",
  mode = "page",
  compact = false
}) {
  const labels = {
    page: {
      public: "Public",
      private: "Private",
      publicDesc: "Anyone can find and view this page",
      privateDesc: "Only you can view this page",
    },
    group: {
      public: "Public",
      private: "Private",
      publicDesc: "Anyone can find and view this group",
      privateDesc: "Only members can access this group",
    },
  };

  const currentLabels = labels[mode] || labels.page;

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
            <Icon name="Globe" size={16} className="text-green-500" />
          ) : (
            <Icon name="Lock" size={16} className="text-amber-500" />
          )}
          {!compact && (
            <span className="text-sm font-medium">
              {isPublic ? currentLabels.public : currentLabels.private}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          onClick={() => onVisibilityChange(true)}
          className="flex items-center gap-2 py-2"
        >
          <div className="flex items-center gap-2 flex-1">
            <Icon name="Globe" size={16} className="text-green-500 flex-shrink-0" />
            <div className="flex flex-col">
              <span className="font-medium">{currentLabels.public}</span>
              <span className="text-xs text-muted-foreground">
                {currentLabels.publicDesc}
              </span>
            </div>
          </div>
          {isPublic && <Icon name="Check" size={16} className="ml-2" />}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => onVisibilityChange(false)}
          className="flex items-center gap-2 py-2"
        >
          <div className="flex items-center gap-2 flex-1">
            <Icon name="Lock" size={16} className="text-amber-500 flex-shrink-0" />
            <div className="flex flex-col">
              <span className="font-medium">{currentLabels.private}</span>
              <span className="text-xs text-muted-foreground">
                {currentLabels.privateDesc}
              </span>
            </div>
          </div>
          {!isPublic && <Icon name="Check" size={16} className="ml-2" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
