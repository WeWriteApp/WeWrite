"use client"

import React, { useRef, useEffect, useState } from 'react';
import { Button } from './button';
import { X } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence, useMotionValue, useAnimation } from 'framer-motion';

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
  preventClickOutside = false,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const y = useMotionValue(0);
  const controls = useAnimation();
  const [isScrollable, setIsScrollable] = useState(false);
  const [atScrollEdge, setAtScrollEdge] = useState(true);

  // Lock background scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Detect if modal content is scrollable
  useEffect(() => {
    if (!isOpen) return;
    const el = contentRef.current;
    if (el) {
      setIsScrollable(el.scrollHeight > el.clientHeight + 2);
      // Listen for scroll to determine if at edge
      const handleScroll = () => {
        setAtScrollEdge(
          el.scrollTop <= 0 || el.scrollTop + el.clientHeight >= el.scrollHeight - 2
        );
      };
      el.addEventListener('scroll', handleScroll);
      handleScroll();
      return () => el.removeEventListener('scroll', handleScroll);
    }
  }, [isOpen, children]);

  // Swipe-to-dismiss logic
  const handleDragEnd = async (_: any, info: { offset: { y: number } }) => {
    if (Math.abs(info.offset.y) > 100 && (atScrollEdge || !isScrollable)) {
      await controls.start({ opacity: 0, y: info.offset.y > 0 ? 300 : -300, transition: { duration: 0.25 } });
      onClose();
    } else {
      controls.start({ y: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } });
    }
  };

  // Handle ESC key press
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

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

  // Add specific touch event handlers for better PWA support
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    // Store the touch target to check if the touch ends on the same element
    if (e.target === e.currentTarget) {
      e.currentTarget.dataset.touchTarget = 'backdrop';
    } else {
      delete e.currentTarget.dataset.touchTarget;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (preventClickOutside) return;

    // Only close if the touch started and ended on the backdrop
    if (e.currentTarget.dataset.touchTarget === 'backdrop' && e.target === e.currentTarget) {
      e.preventDefault();
      e.stopPropagation();
      delete e.currentTarget.dataset.touchTarget;
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto"
          onClick={handleBackdropInteraction}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          aria-modal="true"
          role="dialog"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          {/* Modal Content with swipe-to-dismiss */}
          <motion.div
            ref={modalRef}
            drag={isScrollable ? (atScrollEdge ? 'y' : false) : 'y'}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={0.3}
            style={{ y }}
            animate={controls}
            onDragEnd={handleDragEnd}
            className={cn(
              "relative bg-background rounded-lg shadow-lg border border-border dark:border-border w-full max-w-md p-6 m-4 z-10",
              className
            )}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{
              type: "spring",
              damping: 25,
              stiffness: 300,
              duration: 0.3
            }}
          >
            {showCloseButton && (
              <Button
                variant="outline"
                size="icon"
                className="absolute right-2 top-2"
                onClick={onClose}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </Button>
            )}

            {title && (
              <div className="mb-4">
                <h3 className="text-lg font-semibold">{title}</h3>
              </div>
            )}

            {/* Scrollable content wrapper */}
            <div ref={contentRef} className="py-2 max-h-[70vh] overflow-y-auto">
              {children}
            </div>

            {footer && <div className="mt-4">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Modal;
