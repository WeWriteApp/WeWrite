"use client";

import React, { useRef, useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { Icon } from "@/components/ui/Icon";
import { Button } from "./button";
import { cn } from "../../lib/utils";
import {
  useFocusTrap,
  announceToScreenReader,
  getAccessibleButtonProps,
  getAccessibleIconProps
} from "../../utils/accessibilityHelpers";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  showCloseButton?: boolean;
  preventClickOutside?: boolean;
  /**
   * Always center the modal (dialog style), even on mobile.
   * Use this for alerts/confirmations that should never appear as a drawer.
   * Default: false (uses adaptive behavior: drawer on mobile, dialog on desktop)
   */
  alwaysCentered?: boolean;
}

/**
 * Rebuilt modal with strict layout:
 * - Outer shell capped to viewport height
 * - Inner column uses header (optional), scrollable body, footer (optional)
 * - Body is the ONLY scrollable area; header/footer stay fixed
 */
export function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  className = "",
  showCloseButton = true,
  preventClickOutside = false,
  alwaysCentered = false
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { containerRef, handleKeyDown } = useFocusTrap(isOpen);

  // Memoize ref callback to prevent infinite re-renders with Radix UI compose-refs
  const combinedRef = useCallback((node: HTMLDivElement | null) => {
    // Use type assertion since we're manually managing the ref
    (modalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    (containerRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
  }, [containerRef]);

  useEffect(() => {
    setMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
        announceToScreenReader("Modal closed");
      } else {
        handleKeyDown(event);
      }
    };

    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      document.addEventListener("keydown", handleEscKey);
      announceToScreenReader(title ? `${title} dialog opened` : "Dialog opened");

      return () => {
        document.body.style.overflow = originalStyle;
        document.removeEventListener("keydown", handleEscKey);
      };
    }
  }, [isOpen, onClose, title, handleKeyDown]);

  const handleBackdropInteraction = (
    e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>
  ) => {
    if (preventClickOutside) return;
    if (e.target === e.currentTarget) {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  useEffect(() => {
    if (!isOpen || preventClickOutside) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose, preventClickOutside]);

  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setTouchStart({ x: e.touches[0].clientX, y: e.touches[0].clientY });
    if (e.target === e.currentTarget) {
      e.currentTarget.dataset.touchTarget = "backdrop";
    } else {
      delete e.currentTarget.dataset.touchTarget;
    }
  };
  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (preventClickOutside) return;
    if (isMobile && touchStart) {
      const touchEnd = { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
      const deltaY = touchEnd.y - touchStart.y;
      const deltaX = Math.abs(touchEnd.x - touchStart.x);
      if (deltaY > 100 && deltaX < 50) {
        onClose();
        return;
      }
    }
    if (e.currentTarget.dataset.touchTarget === "backdrop" && e.target === e.currentTarget) {
      e.preventDefault();
      e.stopPropagation();
      delete e.currentTarget.dataset.touchTarget;
      onClose();
    }
  };

  if (!mounted) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className={`fixed inset-0 z-modal flex ${alwaysCentered ? 'items-center' : 'items-end md:items-center'} justify-center overflow-hidden`}
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
          style={{ paddingTop: isMobile ? "20px" : "0" }}
        >
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          <motion.div
            ref={combinedRef}
            className={cn(
              "relative z-10",
              "bg-[var(--card-bg)] border border-[var(--card-border)] backdrop-blur-md",
              alwaysCentered
                ? "w-[calc(100%-2rem)] max-w-lg mx-4 my-5 rounded-2xl"
                : "w-full md:w-[calc(100%-2rem)] md:max-w-lg md:mx-4 md:my-5 rounded-t-2xl md:rounded-2xl",
              "max-h-[90vh] md:max-h-[85vh]",
              "overflow-hidden"
            )}
            onWheel={(e) => e.stopPropagation()}
            initial={{
              opacity: 0,
              y: alwaysCentered ? 0 : (typeof window !== "undefined" && window.innerWidth < 768 ? 100 : -10),
              scale: alwaysCentered ? 0.95 : 1,
              x: 0
            }}
            animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
            exit={{
              opacity: 0,
              y: alwaysCentered ? 0 : (typeof window !== "undefined" && window.innerWidth < 768 ? 100 : 10),
              scale: alwaysCentered ? 0.95 : 1,
              x: 0
            }}
            transition={{ type: "spring", damping: 25, stiffness: 300, duration: 0.3 }}
            style={{ transformOrigin: "center center" }}
          >
            <div className="flex flex-col h-full min-h-0">
              {/* Header */}
              {(showCloseButton || title) && (
                <div className="flex items-start justify-center px-6 pt-6 pb-3 gap-3 flex-shrink-0 relative">
                  {title && (
                    <h2 id="modal-title" className="text-lg font-semibold text-center w-full px-6">
                      {title}
                    </h2>
                  )}
                  {showCloseButton && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-4 top-4"
                      onClick={onClose}
                      {...getAccessibleButtonProps(
                        "Close modal",
                        title ? `Close ${title} dialog` : undefined
                      )}
                    >
                      <Icon name="X" size={16} />
                    </Button>
                  )}
                </div>
              )}

              {/* Body */}
              <div id="modal-content" className="flex-1 min-h-0 px-6 pb-4 overflow-hidden">
                <div
                  className="h-full w-full overflow-y-auto overflow-x-hidden pr-1 -mr-1"
                  style={{ WebkitOverflowScrolling: "touch" }}
                >
                  {children}
                </div>
              </div>

              {/* Footer */}
              {footer && <div className="flex-shrink-0 px-6 pb-6 pt-2">{footer}</div>}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
}

export default Modal;
