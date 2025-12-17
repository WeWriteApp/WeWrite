"use client";
import React, { useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { LucideIcon, GripVertical } from 'lucide-react';

interface DraggableSidebarItemProps {
  id: string;
  icon: LucideIcon;
  label: string;
  href?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  isActive?: boolean;
  index: number;
  moveItem: (dragIndex: number, hoverIndex: number) => void;
  children?: React.ReactNode;
  isDragEnabled?: boolean;
  showContent?: boolean;
  isCompact?: boolean;
}

interface DragItem {
  index: number;
  id: string;
  type: string;
}

/**
 * Clean sidebar item component
 * 
 * Architecture:
 * - Collapsed: 40x40 button centered in 64px sidebar (12px margin each side)
 * - Expanded: Full width button with 12px horizontal padding
 * - Icon stays at exact same X position in both states
 * - Label fades in/out with max-width animation
 */
const DraggableSidebarItem: React.FC<DraggableSidebarItemProps> = ({
  id,
  icon: Icon,
  label,
  onClick,
  onMouseEnter,
  isActive = false,
  index,
  moveItem,
  children,
  isDragEnabled = true,
  showContent = true,
}) => {
  const ref = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  if (!id || !Icon || !label) return null;

  const [{ handlerId }, drop] = useDrop({
    accept: 'sidebar-item',
    collect(monitor) {
      return { handlerId: monitor.getHandlerId() };
    },
    hover(item: DragItem, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleY = (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;

      const hoverClientY = clientOffset.y - hoverBoundingRect.top;
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) return;
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) return;

      moveItem?.(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  const [{ isDragging }, drag] = useDrag({
    type: 'sidebar-item',
    item: () => ({ id, index }),
    collect: (monitor) => ({ isDragging: monitor.isDragging() }),
    canDrag: isDragEnabled,
  });

  if (isDragEnabled) {
    drag(drop(ref));
  } else {
    drop(ref);
  }

  return (
    <div
      ref={ref}
      className={cn("relative group h-10", isDragging && "opacity-40")}
      data-handler-id={handlerId}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/*
        Button structure:
        - Always h-10 (40px) tall
        - Collapsed: w-10 (40px), centered via mx-auto on parent or flex justify-center
        - Expanded: full width with internal padding
      */}
      <button
        onClick={() => onClick?.()}
        onMouseEnter={onMouseEnter}
        className={cn(
          "h-10 flex items-center rounded-lg cursor-pointer border-0",
          "transition-all duration-200 ease-out",
          // Collapsed: square button, Expanded: full width with left padding to align icon
          showContent
            ? "w-full pl-3 pr-2 bg-transparent"
            : "w-10 justify-center bg-transparent",
          // Active state - accent color background and text
          isActive && "bg-accent/15 text-accent",
          // Non-active states - hover and click feedback
          !isActive && [
            "text-muted-foreground",
            // Hover state - subtle background
            "hover:text-foreground hover:bg-muted/60 dark:hover:bg-muted/40",
            // Active/pressed state - darker background with slight scale
            "active:bg-muted active:scale-[0.98] active:duration-75"
          ]
        )}
        title={!showContent ? label : undefined}
        aria-label={label}
      >
        {/* Icon - always 20x20, centered in its space, with hover animation */}
        <motion.div
          whileHover={{ scale: 1.15, y: -1 }}
          whileTap={{ scale: 0.9 }}
          animate={isActive ? { scale: 1.05 } : { scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 17 }}
        >
          <Icon className={cn(
            "w-5 h-5 flex-shrink-0",
            isActive && "text-accent"
          )} />
        </motion.div>
        
        {/* Label - animated width and opacity */}
        <span 
          className={cn(
            "text-sm font-medium truncate whitespace-nowrap overflow-hidden",
            "transition-all duration-300 ease-out",
            showContent 
              ? "ml-3 opacity-100 w-auto max-w-[160px]" 
              : "ml-0 opacity-0 w-0 max-w-0"
          )}
        >
          {label}
        </span>
        
        {children}
      </button>
      
      {/* Drag handle */}
      {showContent && isHovered && isDragEnabled && (
        <GripVertical className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40" />
      )}
    </div>
  );
};

export default DraggableSidebarItem;
