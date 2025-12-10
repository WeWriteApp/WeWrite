"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ExternalLink, Edit2, Trash2 } from "lucide-react";
import { createPortal } from "react-dom";

interface PillLinkContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  position: { x: number; y: number };
  onGoToLink: () => void;
  onEditLink: () => void;
  onDeleteLink?: () => void;
  canEdit?: boolean;
  isDeleted?: boolean;
}

export default function PillLinkContextMenu({
  isOpen,
  onClose,
  position,
  onGoToLink,
  onEditLink,
  onDeleteLink,
  canEdit = true,
  isDeleted = false
}: PillLinkContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [isOpen, onClose]);

  // Adjust position to keep menu within viewport
  const adjustedPosition = React.useMemo(() => {
    if (!isOpen) return position;

    const menuWidth = 160; // Approximate menu width
    const menuHeight = canEdit ? 80 : 40; // Approximate menu height
    const padding = 8;

    let { x, y } = position;

    // Adjust horizontal position
    if (x + menuWidth > window.innerWidth - padding) {
      x = window.innerWidth - menuWidth - padding;
    }
    if (x < padding) {
      x = padding;
    }

    // Adjust vertical position
    if (y + menuHeight > window.innerHeight - padding) {
      y = y - menuHeight - padding;
    }
    if (y < padding) {
      y = padding;
    }

    return { x, y };
  }, [position, isOpen, canEdit]);

  const menuContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.1 }}
          className="fixed z-50 wewrite-card wewrite-floating wewrite-card-no-padding wewrite-card-rounded-lg py-1 min-w-[160px] overflow-hidden"
          style={{
            left: adjustedPosition.x,
            top: adjustedPosition.y,
          }}
        >
          <button
            onClick={() => {
              console.log('🔵 CONTEXT_MENU: Go to link clicked');
              onGoToLink();
              onClose();
            }}
            className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2 transition-colors first:rounded-t-md"
          >
            <ExternalLink size={14} />
            Go to link
          </button>
          
          {canEdit && (
            <button
              onClick={() => {
                onEditLink();
                onClose();
              }}
              className="w-full px-3 py-2.5 text-left text-sm hover:bg-muted flex items-center gap-2 transition-colors"
            >
              <Edit2 size={14} />
              Edit link
            </button>
          )}

          {canEdit && isDeleted && onDeleteLink && (
            <button
              onClick={() => {
                onDeleteLink();
                onClose();
              }}
              className="w-full px-3 py-2.5 text-left text-sm hover:bg-red-100 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-2 transition-colors last:rounded-b-md"
            >
              <Trash2 size={14} />
              Delete link
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );

  // Use portal to render at document body level
  if (typeof window === 'undefined') return null;
  return createPortal(menuContent, document.body);
}
