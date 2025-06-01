"use client";

import React from 'react';
import { Menu } from 'lucide-react';
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem
} from "../ui/dropdown-menu";

interface PageMenuProps {
  onModeChange: (mode: 'dense' | 'normal') => void;
  currentMode: 'dense' | 'normal';
}

export function PageMenu({ onModeChange, currentMode }: PageMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  return (
    <DropdownMenu onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`text-foreground h-8 w-8 transition-colors ${isOpen ? 'bg-accent' : ''}`}
          title="Line modes"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem 
          className={currentMode === 'dense' ? 'bg-accent/50' : ''} 
          onClick={() => onModeChange('dense')}
        >
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 9h6" />
                <path d="M9 12h6" />
                <path d="M9 15h6" />
              </svg>
            </div>
            <span>Dense</span>
          </div>
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          className={currentMode === 'normal' ? 'bg-accent/50' : ''} 
          onClick={() => onModeChange('normal')}
        >
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
                <rect width="18" height="18" x="3" y="3" rx="2" />
                <path d="M9 8h6" />
                <path d="M9 14h6" />
                <path d="M9 20h6" />
              </svg>
            </div>
            <span>Normal</span>
          </div>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
