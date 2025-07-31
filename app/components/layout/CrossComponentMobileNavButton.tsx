"use client"

import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

// Drag item types
export const DRAG_TYPES = {
  CROSS_COMPONENT_ITEM: 'cross-component-item'
};

interface DragItem {
  id: string;
  index: number;
  sourceType: 'mobile' | 'sidebar';
}

interface CrossComponentMobileNavButtonProps {
  id: string;
  index: number;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  onHover?: () => void;
  isActive: boolean;
  ariaLabel: string;
  label: string;
  children?: React.ReactNode;
  sourceType?: 'mobile' | 'sidebar'; // Allow specifying source type
  onCrossComponentDrop?: (
    dragItem: DragItem,
    targetIndex: number,
    targetType: 'mobile' | 'sidebar'
  ) => void;
  moveItem?: (dragIndex: number, hoverIndex: number) => void;
  isPressed?: boolean;
  isNavigating?: boolean;
}

export default function CrossComponentMobileNavButton({
  id,
  index,
  icon: Icon,
  onClick,
  onHover,
  isActive,
  ariaLabel,
  label,
  children,
  sourceType = 'mobile', // Default to mobile for backward compatibility
  onCrossComponentDrop,
  moveItem,
  isPressed = false,
  isNavigating = false
}: CrossComponentMobileNavButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  // Drag functionality
  const [{ isDragging }, drag] = useDrag({
    type: DRAG_TYPES.CROSS_COMPONENT_ITEM,
    item: () => ({
      id,
      index,
      sourceType: sourceType
    }),
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  // Drop functionality - accept drops from other components
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: DRAG_TYPES.CROSS_COMPONENT_ITEM,
    drop: (draggedItem: DragItem) => {
      if (!ref.current) return;

      // Handle cross-component drops (sidebar to mobile, mobile to sidebar)
      if (draggedItem.sourceType !== sourceType && onCrossComponentDrop) {
        const targetType = sourceType === 'mobile' ? 'mobile' : 'sidebar';
        onCrossComponentDrop(draggedItem, index, targetType);
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
      // Accept drops from different components or same-component reordering
      return draggedItem.sourceType !== sourceType || draggedItem.sourceType === sourceType;
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
    if (!isDragging) {
      onClick();
    }
  };

  const handleMouseEnter = () => {
    if (onHover && !isDragging) {
      onHover();
    }
  };

  const handleTouchStart = () => {
    if (onHover && !isDragging) {
      onHover();
    }
  };

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="lg"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onTouchStart={handleTouchStart}
      className={cn(
        "flex flex-col items-center justify-center h-16 flex-1 rounded-lg p-2 relative gap-1 group",
        "transition-all duration-75 ease-out",
        "flex-shrink-0 min-w-0",
        "touch-manipulation select-none",
        // Drag states
        isDragging && "opacity-50 scale-95",
        // Press states
        isPressed && "scale-95 bg-primary/20",
        // Base states with enhanced contrast
        "hover:bg-primary/10 active:bg-primary/20",
        // Active state styling
        isActive
          ? "bg-primary/10 text-primary"
          : [
              "text-slate-600 hover:text-slate-900",
              "dark:text-muted-foreground dark:hover:text-foreground"
            ],
        // Loading state when navigating
        isNavigating && "opacity-75",
        // Drop zone states
        isOver && canDrop && "ring-2 ring-primary/30 bg-primary/5",
        isOver && !canDrop && "ring-2 ring-red-300 bg-red-50 dark:bg-red-900/20"
      )}
      aria-label={ariaLabel}
      aria-pressed={isActive}
      disabled={isNavigating && !isPressed}
      style={{
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
    >
      <div className="relative">
        <Icon className={cn(
          "h-6 w-6 flex-shrink-0 transition-transform duration-75",
          isPressed && "scale-110",
          isDragging && "scale-90"
        )} />
        {children}
      </div>

      {/* Text label - allow 2 lines with smaller text */}
      <span className={cn(
        "text-[10px] font-medium leading-tight transition-colors duration-75",
        "text-center max-w-full px-1",
        "line-clamp-2 break-words", // Allow 2 lines with word breaking
        "h-6 flex items-center justify-center", // Fixed height for consistent layout
        isActive
          ? "text-primary"
          : [
              "text-slate-500 group-hover:text-slate-700",
              "dark:text-muted-foreground/80 dark:group-hover:text-muted-foreground"
            ]
      )}>
        {label}
      </span>
      
      {/* Loading indicator for navigation */}
      {isNavigating && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
        </div>
      )}

      {/* Drop zone visual feedback */}
      {isOver && canDrop && (
        <div className="absolute inset-0 border-2 border-primary/30 rounded-lg pointer-events-none animate-pulse" />
      )}
      {isOver && !canDrop && (
        <div className="absolute inset-0 border-2 border-red-300 rounded-lg pointer-events-none" />
      )}
    </Button>
  );
}
