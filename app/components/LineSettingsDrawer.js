'use client';

import React, { useContext } from 'react';
import { Settings, AlignJustify, AlignLeft, Check } from 'lucide-react';
import { Button } from './ui/button';
import { useLineSettings, LINE_MODES } from '../contexts/LineSettingsContext';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { MobileContext } from '../providers/MobileProvider';
import { DrawerContext } from '../providers/DrawerProvider';

/**
 * LineSettingsDrawer Component
 * 
 * A drawer menu for mobile devices that allows users to switch between different paragraph modes.
 */
export function LineSettingsDrawer() {
  const { lineMode, setLineMode } = useLineSettings();
  const { theme } = useTheme();
  const { isMobile } = useContext(MobileContext);
  const { isOpen, setIsOpen, setSelected } = useContext(DrawerContext);

  // Handle mode change with animation
  const handleModeChange = (mode) => {
    setLineMode(mode);
    setIsOpen(false); // Close drawer after selection
  };

  // Get icon based on mode
  const getModeIcon = (mode) => {
    switch(mode) {
      case LINE_MODES.DENSE:
        return <AlignJustify className="h-5 w-5 mr-3" />;
      case LINE_MODES.NORMAL:
        return <AlignLeft className="h-5 w-5 mr-3" />;
      default:
        return null;
    }
  };

  // Button to open the drawer
  const openDrawer = () => {
    setSelected(
      <div className="p-4">
        <h2 className="text-xl font-semibold mb-6">Paragraph Mode</h2>
        
        <div className="space-y-4">
          <motion.button
            whileHover={{ backgroundColor: "hsl(var(--accent)/0.1)" }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={`w-full flex items-center justify-between p-4 rounded-md ${lineMode === LINE_MODES.NORMAL ? 'bg-accent/50' : 'bg-background'}`}
            onClick={() => handleModeChange(LINE_MODES.NORMAL)}
          >
            <div className="flex items-center">
              {getModeIcon(LINE_MODES.NORMAL)}
              <span className="text-lg">Normal Mode</span>
            </div>
            {lineMode === LINE_MODES.NORMAL && (
              <Check className="h-5 w-5" />
            )}
          </motion.button>
          
          <motion.button
            whileHover={{ backgroundColor: "hsl(var(--accent)/0.1)" }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className={`w-full flex items-center justify-between p-4 rounded-md ${lineMode === LINE_MODES.DENSE ? 'bg-accent/50' : 'bg-background'}`}
            onClick={() => handleModeChange(LINE_MODES.DENSE)}
          >
            <div className="flex items-center">
              {getModeIcon(LINE_MODES.DENSE)}
              <span className="text-lg">Dense Mode</span>
            </div>
            {lineMode === LINE_MODES.DENSE && (
              <Check className="h-5 w-5" />
            )}
          </motion.button>
        </div>
      </div>
    );
    setIsOpen(true);
  };

  return (
    <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-10 w-10 p-0"
        onClick={openDrawer}
      >
        <span className="sr-only">Open paragraph settings</span>
        <Settings className="h-4 w-4" />
      </Button>
    </motion.div>
  );
}
