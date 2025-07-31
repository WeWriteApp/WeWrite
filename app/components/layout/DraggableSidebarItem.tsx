"use client";
import React, { useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';
import { LucideIcon, GripVertical } from 'lucide-react';

interface DraggableSidebarItemProps {
  id: string;
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  isActive?: boolean;
  index: number;
  moveItem: (dragIndex: number, hoverIndex: number) => void;
  children?: React.ReactNode;
  isDragEnabled?: boolean;
  showContent?: boolean; // For desktop sidebar expanded state
  isCompact?: boolean; // For mobile vs desktop styling
}

interface DragItem {
  index: number;
  id: string;
  type: string;
}

const DraggableSidebarItem: React.FC<DraggableSidebarItemProps> = ({
  id,
  icon: Icon,
  label,
  href,
  onClick,
  isActive = false,
  index,
  moveItem,
  children,
  isDragEnabled = true,
  showContent = true,
  isCompact = false,
}) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // Defensive programming - ensure all required props are present
  if (!id || !Icon || !label) {
    console.warn('DraggableSidebarItem: Missing required props', { id, Icon, label });
    return null;
  }

  const [{ handlerId }, drop] = useDrop({
    accept: 'sidebar-item',
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

        // Get vertical middle for sidebar items (they stack vertically)
        const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;

        // Determine mouse position
        const clientOffset = monitor.getClientOffset();
        if (!clientOffset) return;

        // Auto-scroll functionality when dragging near edges
        const scrollContainer = ref.current.closest('.overflow-y-auto');
        if (scrollContainer) {
          const containerRect = scrollContainer.getBoundingClientRect();
          const scrollThreshold = 60; // pixels from edge to start scrolling
          const scrollSpeed = 8; // pixels per scroll step

          // Check if near top edge
          if (clientOffset.y - containerRect.top < scrollThreshold) {
            requestAnimationFrame(() => {
              scrollContainer.scrollTop = Math.max(0, scrollContainer.scrollTop - scrollSpeed);
            });
          }
          // Check if near bottom edge
          else if (containerRect.bottom - clientOffset.y < scrollThreshold) {
            requestAnimationFrame(() => {
              scrollContainer.scrollTop += scrollSpeed;
            });
          }
        }

        // Get pixels to the top
        const hoverClientY = clientOffset.y - hoverBoundingRect.top;

        // Only perform the move when the mouse has crossed half of the items height
        // When dragging up, only move when the cursor is above 50%
        // When dragging down, only move when the cursor is below 50%

        // Dragging up
        if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
          return;
        }

        // Dragging down
        if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
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
        console.warn('Error in sidebar drag hover handler:', error);
      }
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: 'sidebar-item',
    item: () => {
      try {
        return { id, index };
      } catch (error) {
        console.warn('Error creating sidebar drag item:', error);
        return { id: 'unknown', index: 0 };
      }
    },
    collect: (monitor) => {
      try {
        return {
          isDragging: monitor.isDragging(),
        };
      } catch (error) {
        console.warn('Error collecting sidebar drag state:', error);
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
    console.warn('Error setting up sidebar drag and drop refs:', error);
  }

  return (
    <Button
      ref={ref}
      variant="ghost"
      size={isCompact ? "sm" : "default"}
      onClick={onClick}
      className={cn(
        "w-full justify-start transition-all duration-200 group relative",
        // Desktop sidebar styling
        !isCompact && [
          "h-12 px-3",
          showContent ? "justify-start text-left" : "justify-center px-0", // Added text-left
          isActive && "bg-primary/10 text-primary", // Removed right border
          "hover:bg-primary/5",
        ],
        // Mobile sidebar styling
        isCompact && [
          "px-4 py-3 text-sm rounded-md min-h-[48px]",
          "hover:bg-neutral-alpha-2 dark:hover:bg-muted",
          isActive && "bg-primary/10 text-primary",
        ],
        // Dragging state - better visual feedback
        isDragging && [
          "scale-105 shadow-xl z-50 bg-background border border-border",
          "transform rotate-2 opacity-90"
        ],
        // Drag handle cursor when enabled
        isDragEnabled && "cursor-move"
      )}
      style={{ opacity }}
      data-handler-id={handlerId}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Icon */}
      <Icon className={cn(
        "flex-shrink-0 transition-colors duration-200",
        isCompact ? "h-5 w-5 mr-3" : "h-5 w-5",
        !isCompact && !showContent && "mx-auto",
        !isCompact && showContent && "mr-3",
        isActive && "text-primary"
      )} />
      
      {/* Label - only show when content should be visible */}
      {(isCompact || showContent) && (
        <span className={cn(
          "transition-colors duration-200 truncate flex-1",
          isActive && "text-primary",
          isCompact ? "text-sm" : "text-sm font-medium"
        )}>
          {label}
        </span>
      )}

      {/* Drag handle - show on right side when expanded and hovered */}
      {!isCompact && showContent && isHovered && isDragEnabled && (
        <GripVertical className="h-4 w-4 text-muted-foreground/50 ml-2 flex-shrink-0" />
      )}

      {/* Children (like notification badges or status icons) */}
      {children}


    </Button>
  );
};

export default DraggableSidebarItem;
