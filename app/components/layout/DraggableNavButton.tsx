"use client";
import React, { useRef } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { Icon } from '@/components/ui/Icon';

interface DraggableNavButtonProps {
  id: string;
  icon: string;
  onClick: () => void;
  onHover?: () => void;
  isActive: boolean;
  ariaLabel: string;
  label: string;
  index: number;
  moveItem: (dragIndex: number, hoverIndex: number) => void;
  children?: React.ReactNode;
  isDragEnabled?: boolean;
}

interface DragItem {
  index: number;
  id: string;
  type: string;
}

const DraggableNavButton: React.FC<DraggableNavButtonProps> = ({
  id,
  icon,
  onClick,
  onHover,
  isActive,
  ariaLabel,
  label,
  index,
  moveItem,
  children,
  isDragEnabled = true,
}) => {
  const ref = useRef<HTMLButtonElement>(null);

  // Defensive programming - ensure all required props are present
  if (!id || !icon || !onClick || !ariaLabel || !label) {
    console.warn('DraggableNavButton: Missing required props', { id, icon, onClick, ariaLabel, label });
    return null;
  }

  const [{ handlerId }, drop] = useDrop({
    accept: 'nav-button',
    collect(monitor) {
      return {
        handlerId: monitor.getHandlerId(),
      };
    },
    hover(item: DragItem, monitor) {
      try {
        if (!ref.current) {
          return;
        }
        const dragIndex = item.index;
        const hoverIndex = index;

        // Don't replace items with themselves
        if (dragIndex === hoverIndex) {
          return;
        }

        // Determine rectangle on screen
        const hoverBoundingRect = ref.current?.getBoundingClientRect();

        // Get horizontal middle
        const hoverMiddleX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2;

        // Determine mouse position
        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) return;

        // Get pixels to the left
        const hoverClientX = clientOffset.x - hoverBoundingRect.left;

        // Only perform the move when the mouse has crossed half of the items width
        // When dragging left, only move when the cursor is below 50%
        // When dragging right, only move when the cursor is above 50%

        // Dragging left
        if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) {
          return;
        }

        // Dragging right
        if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) {
          return;
        }

        // Time to actually perform the action
        if (typeof moveItem === 'function') {
          moveItem(dragIndex, hoverIndex);
        }

        // Note: we're mutating the monitor item here!
        // Generally it's better to avoid mutations,
        // but it's good here for the sake of performance
        // to avoid expensive index searches.
        item.index = hoverIndex;
      } catch (error) {
        console.warn('Error in drag hover handler:', error);
      }
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: 'nav-button',
    item: () => {
      try {
        return { id, index };
      } catch (error) {
        console.warn('Error creating drag item:', error);
        return { id: 'unknown', index: 0 };
      }
    },
    collect: (monitor) => {
      try {
        return {
          isDragging: monitor.isDragging(),
        };
      } catch (error) {
        console.warn('Error collecting drag state:', error);
        return { isDragging: false };
      }
    },
    canDrag: isDragEnabled,
  });

  const opacity = isDragging ? 0.4 : 1;

  // Combine drag and drop refs with error handling
  try {
    if (isDragEnabled) {
      drag(drop(ref));
    } else {
      drop(ref);
    }
  } catch (error) {
    console.warn('Error setting up drag and drop refs:', error);
  }

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="lg"
      onClick={onClick}
      onMouseEnter={onHover}
      onTouchStart={onHover}
      className={cn(
        "flex flex-col items-center justify-center h-16 flex-1 rounded-lg p-1 relative group",
        "transition-all duration-75 ease-out",
        "flex-shrink-0 min-w-0",
        "touch-manipulation select-none",
        // Active state styling
        isActive && "bg-primary/10 text-primary",
        // Hover states
        "nav-hover-state nav-active-state",
        "text-muted-foreground hover:text-foreground",
        // Dragging state
        isDragging && "scale-105 shadow-lg z-10",
        // Drag handle cursor when enabled
        isDragEnabled && "cursor-move"
      )}
      style={{ opacity }}
      aria-label={ariaLabel}
      aria-pressed={isActive}
      data-handler-id={handlerId}
    >
      {/* Icon */}
      <Icon name={icon} size={20} className={cn(
        "flex-shrink-0 transition-colors duration-75 mb-1",
        isActive && "text-primary"
      )} />

      {/* Label */}
      <span className={cn(
        "text-xs font-medium transition-colors duration-75",
        isActive && "text-primary"
      )}>
        {label}
      </span>

      {/* Children (like notification badges) */}
      {children}

      {/* Drag indicator */}
      {isDragEnabled && (
        <div className={cn(
          "absolute -top-1 left-1/2 transform -translate-x-1/2",
          "w-8 h-1 bg-muted-foreground/20 rounded-full",
          "opacity-0 group-hover:opacity-100 transition-opacity duration-200",
          isDragging && "opacity-100"
        )} />
      )}
    </Button>
  );
};

export default DraggableNavButton;
