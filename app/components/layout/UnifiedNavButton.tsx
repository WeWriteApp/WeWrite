"use client"

import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { cn } from '../../lib/utils';

// Single drag type for all items
const DRAG_TYPE = 'unified-nav-item';

interface DragItem {
  id: string;
  index: number;
  originalIndex: number;
}

interface UnifiedNavButtonProps {
  id: string;
  index: number;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  isActive: boolean;
  ariaLabel: string;
  label: string;
  children?: React.ReactNode;
  moveItem: (fromIndex: number, toIndex: number) => void;
  editMode?: boolean;
  isPressed?: boolean;
  isNavigating?: boolean;
}

export default function UnifiedNavButton({
  id,
  index,
  icon: Icon,
  onClick,
  isActive,
  ariaLabel,
  label,
  children,
  moveItem,
  editMode = false,
  isPressed = false,
  isNavigating = false,
}: UnifiedNavButtonProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Drag functionality
  const [{ isDragging }, drag, preview] = useDrag({
    type: DRAG_TYPE,
    item: (): DragItem => {
      return { id, index, originalIndex: index };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: () => editMode,
    end: (item, monitor) => {
      // If drop didn't happen (cancelled), we don't need to do anything
      // The state will naturally reset
    },
  });

  // Drop functionality - reorder on drop
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: DRAG_TYPE,
    canDrop: (draggedItem: DragItem) => {
      return editMode && draggedItem.id !== id;
    },
    drop: (draggedItem: DragItem) => {
      if (draggedItem.id === id) return;
      // Use originalIndex to ensure correct source position
      moveItem(draggedItem.originalIndex, index);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  // Connect drag and drop to the ref - use preview to hide default browser drag
  drag(drop(ref));

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging && !editMode) {
      onClick();
    }
  };

  // Show drop zone indicator when another item is being dragged over this one
  const showDropIndicator = isOver && canDrop;

  return (
    <div 
      ref={ref}
      className={cn(
        // Base sizing - increased height for better tap targets on mobile
        "flex flex-col items-center justify-center h-14 flex-1 rounded-lg py-1 px-1 relative gap-0.5",
        "transition-all duration-150 ease-out",
        "flex-shrink-0 min-w-0",
        "touch-manipulation select-none",
        // Background and hover states (only when not in edit mode)
        !editMode && "hover:bg-muted/80 active:bg-muted dark:hover:bg-muted/60 dark:active:bg-muted/80",
        // Dragging state - show as semi-transparent
        isDragging && "opacity-40",
        // Wiggle animation when in edit mode (but not while dragging)
        editMode && !isDragging && "animate-wiggle",
        // Press feedback (only outside edit mode)
        !editMode && isPressed && "scale-110 duration-75 bg-muted",
        !editMode && "active:scale-95 active:duration-75",
        // Active state
        isActive
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground",
        // Navigation loading state
        isNavigating && "opacity-75",
        // Drop zone indicator - ring around the target
        showDropIndicator && "ring-2 ring-primary bg-primary/10 scale-105"
      )}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-pressed={isActive}
      style={{
        cursor: editMode ? (isDragging ? 'grabbing' : 'grab') : 'pointer'
      }}
    >
      <div className="relative">
        <Icon className={cn(
          // Original icon size from the old NavButton
          "h-5 w-5 flex-shrink-0 transition-transform duration-75",
          isPressed && !editMode && "scale-110"
        )} />
        {children}
      </div>

      <span className={cn(
        "text-[10px] font-medium leading-tight transition-colors duration-75",
        "text-center max-w-full",
        "line-clamp-1",
        isActive && "text-foreground"
      )}>
        {label}
      </span>
      
      {isNavigating && !editMode && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
        </div>
      )}
    </div>
  );
}
