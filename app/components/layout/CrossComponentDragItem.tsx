"use client"

import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { cn } from '../../lib/utils';

// Drag item types - must match CrossComponentMobileNavButton
export const DRAG_TYPES = {
  CROSS_COMPONENT_ITEM: 'cross-component-item'
};

interface DragItem {
  id: string;
  index: number;
  sourceType: 'mobile' | 'sidebar';
}

interface CrossComponentDragItemProps {
  id: string;
  index: number;
  sourceType: 'mobile' | 'sidebar';
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  onCrossComponentDrop?: (
    dragItem: DragItem,
    targetIndex: number,
    targetType: 'mobile' | 'sidebar'
  ) => void;
  moveItem?: (dragIndex: number, hoverIndex: number) => void;
  isCompact?: boolean;
  children?: React.ReactNode;
  className?: string;
  acceptDropTypes?: ('mobile' | 'sidebar')[];
}

export default function CrossComponentDragItem({
  id,
  index,
  sourceType,
  icon: Icon,
  label,
  onClick,
  onCrossComponentDrop,
  moveItem,
  isCompact = false,
  children,
  className,
  acceptDropTypes = []
}: CrossComponentDragItemProps) {
  const ref = useRef<HTMLDivElement>(null);

  // Drag functionality
  const [{ isDragging }, drag] = useDrag({
    type: DRAG_TYPES.CROSS_COMPONENT_ITEM,
    item: () => ({
      id,
      index,
      sourceType
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Drop functionality - only accept drops if acceptDropTypes is specified
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: DRAG_TYPES.CROSS_COMPONENT_ITEM,
    drop: (draggedItem: DragItem) => {
      if (!ref.current) return;
      
      // Handle cross-component drops
      if (draggedItem.sourceType !== sourceType && onCrossComponentDrop) {
        onCrossComponentDrop(draggedItem, index, sourceType);
        return;
      }
      
      // Handle same-component reordering
      if (draggedItem.sourceType === sourceType && moveItem) {
        if (draggedItem.index !== index) {
          moveItem(draggedItem.index, index);
        }
      }
    },
    canDrop: (draggedItem: DragItem) => {
      // Allow drops from different source types if acceptDropTypes includes the source
      if (draggedItem.sourceType !== sourceType) {
        return acceptDropTypes.includes(draggedItem.sourceType);
      }
      // Always allow same-component reordering
      return true;
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  // Combine drag and drop refs
  drag(drop(ref));

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClick && !isDragging) {
      onClick();
    }
  };

  return (
    <div
      ref={ref}
      onClick={handleClick}
      className={cn(
        "flex w-full rounded-md transition-all duration-200 cursor-pointer select-none relative",
        // Layout: compact = horizontal, non-compact = vertical (for grid)
        isCompact ? "items-center px-3 py-2 text-sm" : "flex-col items-center justify-center px-4 py-3 text-center",
        "hover:bg-accent/50 active:bg-accent/70",
        "min-h-[48px] touch-manipulation",
        // Drag states
        isDragging && "opacity-50 scale-95",
        // Drop states
        isOver && canDrop && "bg-muted/20 ring-2 ring-border/30",
        isOver && !canDrop && "bg-red-50 dark:bg-red-900/20",
        className
      )}
      style={{
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
    >
      <Icon className={cn(
        "flex-shrink-0",
        isCompact ? "mr-3 h-4 w-4" : "mb-2 h-6 w-6"
      )} />
      <span className={cn(
        "font-medium truncate",
        isCompact ? "flex-1" : "text-xs text-center max-w-full"
      )}>
        {label}
      </span>
      {children}

      {/* Visual feedback for drop zones */}
      {isOver && canDrop && (
        <div className="absolute inset-0 border-2 border-border rounded-md pointer-events-none" />
      )}
      {isOver && !canDrop && (
        <div className="absolute inset-0 border-2 border-error-30 rounded-md pointer-events-none" />
      )}
    </div>
  );
}
