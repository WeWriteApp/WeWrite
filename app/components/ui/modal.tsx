"use client"

import React, { useRef, useEffect, useState } from 'react';
import { Button } from './button';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useFocusTrap, announceToScreenReader, getAccessibleButtonProps, getAccessibleIconProps } from '../../utils/accessibilityHelpers';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
  preventClickOutside?: boolean;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className,
  showCloseButton = true,
  preventClickOutside = false}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Enhanced accessibility with focus trap
  const { containerRef, handleKeyDown } = useFocusTrap(isOpen);

  // Ensure we're mounted on the client side and detect mobile
  useEffect(() => {
    setMounted(true);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Enhanced keyboard handling with accessibility and body scroll prevention
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
        announceToScreenReader('Modal closed');
      } else {
        // Handle focus trapping for other keys
        handleKeyDown(event);
      }
    };

    if (isOpen) {
      // Prevent body scroll when modal is open
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';
      document.addEventListener('keydown', handleEscKey);

      // Announce modal opening to screen readers
      announceToScreenReader(title ? `${title} dialog opened` : 'Dialog opened');

      return () => {
        // Restore body scroll when modal closes
        document.body.style.overflow = originalStyle;
        document.removeEventListener('keydown', handleEscKey);
      };
    }
  }, [isOpen, onClose, title, handleKeyDown]);

  // Handle click and touch events outside
  const handleBackdropInteraction = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (preventClickOutside) return;

    // Only close if interacting directly with the backdrop (not with modal content)
    if (e.target === e.currentTarget) {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  // Add a more reliable click outside handler using useEffect
  useEffect(() => {
    if (!isOpen || preventClickOutside) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    // Add the event listener with a slight delay to prevent immediate closing
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, preventClickOutside]);

  // Touch handling for swipe-to-close on mobile
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // Store touch start position for swipe detection
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY});

    // Store the touch target to check if the touch ends on the same element
    if (e.target === e.currentTarget) {
      e.currentTarget.dataset.touchTarget = 'backdrop';
    } else {
      delete e.currentTarget.dataset.touchTarget;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (preventClickOutside) return;

    // Check for swipe down gesture on mobile
    if (isMobile && touchStart) {
      const touchEnd = {
        x: e.changedTouches[0].clientX,
        y: e.changedTouches[0].clientY};

      const deltaY = touchEnd.y - touchStart.y;
      const deltaX = Math.abs(touchEnd.x - touchStart.x);

      // Swipe down to close (minimum 100px down, less than 50px horizontal)
      if (deltaY > 100 && deltaX < 50) {
        onClose();
        return;
      }
    }

    // Only close if the touch started and ended on the backdrop
    if (e.currentTarget.dataset.touchTarget === 'backdrop' && e.target === e.currentTarget) {
      e.preventDefault();
      e.stopPropagation();
      delete e.currentTarget.dataset.touchTarget;
      onClose();
    }
  };

  // Don't render anything on server side or if not mounted
  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-[100] flex md:items-center md:justify-center items-end justify-center overflow-hidden"
          onClick={handleBackdropInteraction}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          aria-modal="true"
          role="dialog"
          aria-labelledby={title ? "modal-title" : undefined}
          aria-describedby="modal-content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 100,
            // Add top padding for mobile to create gap from screen edge
            paddingTop: isMobile ? '20px' : '0'
          }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Modal Content */}
          <motion.div
            ref={(node) => {
              if (modalRef.current !== node) modalRef.current = node;
              if (containerRef.current !== node) containerRef.current = node;
            }}
            className={cn(
              // Base styles
              "relative z-10",
              // Use proper card styling instead of deprecated glass-overlay
              "bg-[var(--card-bg)] border border-[var(--card-border)]",
              // Add backdrop blur for glassmorphism effect
              "backdrop-blur-md",
              // Mobile: Full screen slide-up modal with top margin
              "w-full rounded-t-2xl md:rounded-2xl",
              // Mobile height: account for top padding (20px) to prevent full screen coverage
              "h-[calc(100%-20px)] md:h-auto",
              // Desktop: Centered modal with constraints and overflow handling
              "md:w-[calc(100%-2rem)] md:max-w-md md:max-h-[calc(100vh-40px)] md:mx-4 md:my-5",
              // Padding and overflow
              "p-6 overflow-hidden flex flex-col",
              className
            )}
            onWheel={(e) => {
              // Prevent wheel events from bubbling to background
              e.stopPropagation();
            }}
            initial={{
              opacity: 0,
              y: typeof window !== 'undefined' && window.innerWidth < 768 ? 100 : -10
            }}
            animate={{ opacity: 1, y: 0 }}
            exit={{
              opacity: 0,
              y: typeof window !== 'undefined' && window.innerWidth < 768 ? 100 : 10
            }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 300,
              duration: 0.3
            }}
            style={{
              position: 'relative',
              zIndex: 101
            }}
          >
            {showCloseButton && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-2 top-2"
                onClick={onClose}
                {...getAccessibleButtonProps('Close modal', title ? `Close ${title} dialog` : undefined)}
              >
                <X className="h-4 w-4" {...getAccessibleIconProps()} />
              </Button>
            )}

            {title && (
              <div className="mb-4 text-center flex-shrink-0">
                <h2 id="modal-title" className="text-lg font-semibold w-full">{title}</h2>
              </div>
            )}

            <div id="modal-content" className="py-2 flex-1 min-h-0 overflow-y-auto overflow-x-hidden">{children}</div>

            {footer && <div className="mt-4 flex-shrink-0">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Use portal to render modal at document body level, outside any container constraints
  return createPortal(modalContent, document.body);
}

export default Modal;