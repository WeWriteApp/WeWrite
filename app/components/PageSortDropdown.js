"use client";

import React from 'react';
import { Button } from './ui/button';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator
} from './ui/dropdown-menu';
import { 
  ArrowDownAZ, 
  ArrowUpAZ, 
  Clock, 
  Eye, 
  ChevronDown,
  CalendarDays,
  SortAsc,
  SortDesc
} from 'lucide-react';

const sortOptions = [
  { id: 'newest', label: 'Newest', icon: Clock },
  { id: 'oldest', label: 'Oldest', icon: CalendarDays },
  { id: 'recently_edited', label: 'Recently Edited', icon: Clock },
  { id: 'most_views', label: 'Most Views', icon: Eye },
  { id: 'alpha_asc', label: 'A-Z', icon: ArrowDownAZ },
  { id: 'alpha_desc', label: 'Z-A', icon: ArrowUpAZ },
];

export default function PageSortDropdown({ value, onValueChange }) {
  // Get the current sort option
  const currentOption = sortOptions.find(option => option.id === value) || sortOptions[0];
  const Icon = currentOption.icon;
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{currentOption.label}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Sort Pages</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={value} onValueChange={onValueChange}>
          {sortOptions.map((option) => {
            const OptionIcon = option.icon;
            return (
              <DropdownMenuRadioItem key={option.id} value={option.id} className="cursor-pointer">
                <div className="flex items-center gap-2">
                  <OptionIcon className="h-4 w-4" />
                  <span>{option.label}</span>
                </div>
              </DropdownMenuRadioItem>
            );
          })}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
