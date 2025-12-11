"use client";

import React, { useEffect, useRef, useState, useLayoutEffect } from "react";
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
  const [isVisible, setIsVisible] = useState(false);
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  // Calculate position synchronously before showing
  useLayoutEffect(() => {
    if (!isOpen) {
      setIsVisible(false);
      return;
    }

    const menuWidth = 160;
    const menuHeight = canEdit ? 80 : 40;
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

    setAdjustedPosition({ x, y });
    // Show after position is calculated
    setIsVisible(true);
  }, [isOpen, position, canEdit]);

  // Close menu when clicking outside
  useEffect(() => {
    if (!isOpen) return;

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

    // Add listeners after a frame to prevent immediate close from the same click
    const timer = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
    });

    return () => {
      cancelAnimationFrame(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  // Don't render anything if not open
  if (!isOpen) return null;

  const menuContent = (
    <div
      ref={menuRef}
      className="fixed z-50 wewrite-card wewrite-floating wewrite-card-no-padding wewrite-card-rounded-lg py-1 min-w-[160px] overflow-hidden transition-opacity duration-75"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'scale(1)' : 'scale(0.95)',
        transition: 'opacity 75ms ease-out, transform 75ms ease-out',
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
    </div>
  );

  // Use portal to render at document body level
  if (typeof window === 'undefined') return null;
  return createPortal(menuContent, document.body);
}
