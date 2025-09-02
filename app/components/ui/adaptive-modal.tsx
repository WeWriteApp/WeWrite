import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from './drawer';

interface AdaptiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  mobileHeight?: string;
}

/**
 * Adaptive modal that switches between Dialog (desktop) and Drawer (mobile)
 * Handles responsive behavior and consistent API
 */
export function AdaptiveModal({
  isOpen,
  onClose,
  title,
  children,
  className = "",
  mobileHeight = "85vh"
}: AdaptiveModalProps) {
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    // Initial check
    checkMobile();

    // Listen for resize events
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle close events consistently
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  if (isMobile) {
    return (
      <Drawer open={isOpen} onOpenChange={handleOpenChange}>
        <DrawerContent height={mobileHeight} className={className}>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          
          <div className="flex-1 min-h-0 flex flex-col px-4 pb-4">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className={`sm:max-w-2xl ${className}`}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        {children}
      </DialogContent>
    </Dialog>
  );
}
