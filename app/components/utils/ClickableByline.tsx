"use client";

import React, { useState, ReactNode } from 'react';
import { Icon } from '@/components/ui/Icon';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger} from '../ui/dropdown-menu';

interface ClickableBylineProps {
  children: ReactNode;
  dropdown: ReactNode;
  isLoading?: boolean;
  isChanging?: boolean;
}

/**
 * ClickableByline component that makes the entire byline clickable to open the dropdown
 * This is used for pages where the current user can change ownership
 */
export default function ClickableByline({
  children,
  dropdown,
  isLoading = false,
  isChanging = false}: ClickableBylineProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <div
          className="flex items-center gap-1 cursor-pointer hover:underline group"
          aria-label="Change page ownership"
        >
          {children}
          <span className="flex items-center">
            {isChanging ? (
              <Icon name="Loading" size={12} trigger="loop" />
            ) : (
              <Icon name="ChevronDown" size={12} className="transition-transform duration-200 ease-in-out group-hover:text-foreground" />
            )}
          </span>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="center"
        className="w-56 animate-in fade-in-50 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2"
        sideOffset={5}
      >
        {dropdown}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}