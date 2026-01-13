import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from './dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from './drawer';

interface AdaptiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /** Optional subtitle/description shown below the title */
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
  mobileHeight?: string;
  /** Hash ID to add to URL when drawer is open (e.g., "modal" -> #modal) */
  hashId?: string;
  /** Analytics ID for tracking drawer open/close events */
  analyticsId?: string;
  /** Show X close button in top right corner (desktop only) */
  showCloseButton?: boolean;
}

/**
 * Adaptive modal that switches between Dialog (desktop) and Drawer (mobile)
 * Handles responsive behavior and consistent API
 */
export function AdaptiveModal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  className = "",
  mobileHeight = "85vh",
  hashId,
  analyticsId,
  showCloseButton = false
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
      <Drawer open={isOpen} onOpenChange={handleOpenChange} hashId={hashId} analyticsId={analyticsId}>
        <DrawerContent height={mobileHeight} className={className}>
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
            )}
          </DrawerHeader>

          <div className="flex-1 min-h-0 flex flex-col px-4 pb-4">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange} hashId={hashId} analyticsId={analyticsId}>
      <DialogContent className={`sm:max-w-2xl ${className}`} showCloseButton={showCloseButton}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {subtitle && (
            <DialogDescription>{subtitle}</DialogDescription>
          )}
        </DialogHeader>

        <DialogBody>
          {children}
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
