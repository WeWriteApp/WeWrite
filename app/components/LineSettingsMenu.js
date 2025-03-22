'use client';

import React from 'react';
import { Settings, AlignJustify, AlignLeft, Check } from 'lucide-react';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal
} from './ui/dropdown-menu';
import { Button } from './ui/button';
import { useLineSettings, LINE_MODES } from '../contexts/LineSettingsContext';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';

export function LineSettingsMenu() {
  const { lineMode, setLineMode } = useLineSettings();
  const { theme } = useTheme();

  // Handle mode change with animation
  const handleModeChange = (mode) => {
    setLineMode(mode);
  };

  // Get icon based on mode
  const getModeIcon = (mode) => {
    switch(mode) {
      case LINE_MODES.DENSE:
        return <AlignJustify className="h-4 w-4 mr-2" />;
      case LINE_MODES.NORMAL:
        return <AlignLeft className="h-4 w-4 mr-2" />;
      default:
        return null;
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
          <Button variant="ghost" size="sm" className="h-10 w-10 p-0">
            <span className="sr-only">Open paragraph settings</span>
            <Settings className="h-4 w-4" />
          </Button>
        </motion.div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Paragraph Mode</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup value={lineMode} onValueChange={handleModeChange}>
          <motion.div
            whileHover={{ backgroundColor: "hsl(var(--accent)/0.1)" }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <DropdownMenuRadioItem 
              value={LINE_MODES.DENSE}
              className="cursor-pointer focus:bg-accent focus:text-accent-foreground data-[state=checked]:bg-accent/50"
            >
              <div className="flex items-center">
                {getModeIcon(LINE_MODES.DENSE)}
                <span>Dense</span>
              </div>
              {lineMode === LINE_MODES.DENSE && (
                <Check className="h-4 w-4 ml-auto" />
              )}
            </DropdownMenuRadioItem>
          </motion.div>
          
          <motion.div
            whileHover={{ backgroundColor: "hsl(var(--accent)/0.1)" }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
          >
            <DropdownMenuRadioItem 
              value={LINE_MODES.NORMAL}
              className="cursor-pointer focus:bg-accent focus:text-accent-foreground data-[state=checked]:bg-accent/50"
            >
              <div className="flex items-center">
                {getModeIcon(LINE_MODES.NORMAL)}
                <span>Normal</span>
              </div>
              {lineMode === LINE_MODES.NORMAL && (
                <Check className="h-4 w-4 ml-auto" />
              )}
            </DropdownMenuRadioItem>
          </motion.div>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
