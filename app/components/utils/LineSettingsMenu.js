'use client';

import React, { useContext } from 'react';
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
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { useLineSettings, LINE_MODES } from "../../contexts/LineSettingsContext';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { MobileContext } from "../providers/MobileProvider';
import { LineSettingsDrawer } from "./LineSettingsDrawer';

/**
 * LineSettingsMenu Component
 *
 * A dropdown menu that allows users to switch between different paragraph modes.
 *
 * Available Paragraph Modes:
 * 1. Normal Mode: Traditional document style with paragraph numbers creating indentation
 *    - Numbers positioned to the left of the text
 *    - Clear indent for each paragraph
 *    - Proper spacing between paragraphs
 *    - Standard text size (1rem/16px)
 *
 * 2. Dense Mode: Collapses all paragraphs for a more comfortable reading experience
 *    - NO line breaks between paragraphs
 *    - Text wraps continuously as if newline characters were temporarily deleted
 *    - Paragraph numbers inserted inline within the continuous text
 *    - Only a small space separates paragraphs
 *    - Standard text size (1rem/16px)
 *
 * Features:
 * - Animated menu items using framer-motion
 * - Visual icons to represent each paragraph mode
 * - Persists selection in localStorage via LineSettingsContext
 * - Consistent styling with the rest of the application
 */
export function LineSettingsMenu() {
  const { lineMode, setLineMode } = useLineSettings();
  const { theme } = useTheme();
  const { isMobile } = useContext(MobileContext);

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

  // Use drawer on mobile, dropdown on desktop
  if (isMobile) {
    return <LineSettingsDrawer />;
  }

  // Desktop dropdown menu
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
