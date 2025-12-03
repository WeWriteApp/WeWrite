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
  editMode?: boolean; // When true, enables drag-and-drop and wiggle animation
  isPlaceholder?: boolean; // When true, shows as empty drop zone
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
  isNavigating = false,
  editMode = false,
  isPlaceholder = false
}: CrossComponentMobileNavButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);

  // Drag functionality - only enabled when editMode is true
  const [{ isDragging }, drag] = useDrag({
    type: DRAG_TYPES.CROSS_COMPONENT_ITEM,
    item: () => {
      console.log('🎯 Drag started:', { id, index, sourceType, editMode });
      return {
        id,
        index,
        sourceType: sourceType
      };
    },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    canDrag: () => {
      const canDragResult = editMode && !isPlaceholder;
      console.log('🎯 canDrag check:', { id, editMode, isPlaceholder, result: canDragResult });
      return canDragResult;
    },
  });

  // Drop functionality - iOS-style "push" behavior
  // Items reorder on HOVER, not on drop - this creates the push effect
  const [{ isOver, canDrop }, drop] = useDrop({
    accept: DRAG_TYPES.CROSS_COMPONENT_ITEM,
    hover: (draggedItem: DragItem, monitor) => {
      // Only process hover in edit mode
      if (!editMode || !ref.current) return;
      
      // Don't hover on self
      if (draggedItem.id === id) return;
      
      // Only handle same-component reordering on hover (iOS-style push)
      if (draggedItem.sourceType === sourceType && moveItem) {
        const dragIndex = draggedItem.index;
        const hoverIndex = index;
        
        // Don't replace items with themselves
        if (dragIndex === hoverIndex) return;
        
        // Determine rectangle on screen
        const hoverBoundingRect = ref.current.getBoundingClientRect();
        
        // Get horizontal middle
        const hoverMiddleX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2;
        
        // Determine mouse position
        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) return;
        
        // Get pixels to the left
        const hoverClientX = clientOffset.x - hoverBoundingRect.left;
        
        // Only perform the move when the mouse has crossed half of the item's width
        // When dragging right, only move when cursor is past 50%
        // When dragging left, only move when cursor is before 50%
        if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) return;
        if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) return;
        
        // Time to actually perform the action - this creates the "push" effect
        moveItem(dragIndex, hoverIndex);
        
        // Note: we're mutating the monitor item here!
        // Generally it's better to avoid mutations,
        // but it's good here for the sake of performance
        // to avoid expensive index searches.
        draggedItem.index = hoverIndex;
      }
    },
    drop: (draggedItem: DragItem) => {
      console.log('📦 Drop triggered:', {
        draggedItem,
        targetId: id,
        targetIndex: index,
        sourceType,
        editMode,
        hasRef: !!ref.current,
        isSameItem: draggedItem.id === id,
        isCrossComponent: draggedItem.sourceType !== sourceType,
        hasHandler: !!onCrossComponentDrop
      });
      
      // Cross-component drops still happen on drop (not hover)
      if (!editMode || !ref.current) {
        console.log('📦 Drop blocked: editMode or ref issue');
        return;
      }
      if (draggedItem.id === id) {
        console.log('📦 Drop blocked: same item');
        return;
      }

      // Handle cross-component drops (sidebar to mobile, mobile to sidebar)
      if (draggedItem.sourceType !== sourceType && onCrossComponentDrop) {
        console.log('📦 Calling onCrossComponentDrop');
        const targetType = sourceType === 'mobile' ? 'mobile' : 'sidebar';
        onCrossComponentDrop(draggedItem, index, targetType);
      } else {
        console.log('📦 Not a cross-component drop or no handler');
      }
    },
    canDrop: (draggedItem: DragItem) => {
      if (!editMode) return false;
      if (draggedItem.id === id) return false;
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
        "flex flex-col items-center justify-center h-14 flex-1 rounded-lg py-1 px-2 relative gap-0.5 group",
        // Smooth transitions for the "push" effect - items animate when pushed
        "transition-all duration-150 ease-out",
        "flex-shrink-0 min-w-0",
        "touch-manipulation select-none",
        // Override ghost button's low-opacity active states with more solid feedback
        "hover:bg-muted/80 active:bg-muted dark:hover:bg-muted/60 dark:active:bg-muted/80",
        // Drag states - the dragged item becomes semi-transparent
        isDragging && "opacity-30 scale-90 shadow-lg z-50",
        // Wiggle animation when in edit mode (but not while dragging)
        editMode && !isDragging && "animate-wiggle",
        // Springy scale animations - only apply when not in edit mode
        !editMode && isPressed && "scale-110 duration-75 bg-muted",
        !editMode && "active:scale-95 active:duration-75",
        // Base states with enhanced contrast
        "nav-hover-state",
        // Active state styling
        isActive
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:text-foreground",
        // Loading state when navigating
        isNavigating && "opacity-75",
        // Drop zone indicator for cross-component drops
        isOver && canDrop && "ring-2 ring-primary/50 bg-primary/10"
      )}
      aria-label={ariaLabel}
      aria-pressed={isActive}
      disabled={isNavigating && !isPressed}
      style={{
        cursor: editMode ? (isDragging ? 'grabbing' : 'grab') : 'pointer'
      }}
    >
      <div className="relative">
        <Icon className={cn(
          "h-7 w-7 flex-shrink-0 transition-transform duration-75",
          isPressed && "scale-110",
          isDragging && "scale-90"
        )} />
        {children}
      </div>

      {/* Text label - allow 2 lines with smaller text */}
      <span className={cn(
        "text-[10px] font-medium leading-tight transition-colors duration-75",
        "text-center max-w-full",
        "line-clamp-2 break-words", // Allow 2 lines with word breaking
        isActive && "text-foreground"
      )}>
        {label}
      </span>
      
      {/* Loading indicator for navigation */}
      {isNavigating && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-1 h-1 bg-primary rounded-full animate-pulse" />
        </div>
      )}

      {/* Cross-component drop zone indicator */}
      {isOver && canDrop && (
        <div className="absolute inset-0 border-2 border-primary/50 rounded-lg pointer-events-none" />
      )}
    </Button>
  );
}
