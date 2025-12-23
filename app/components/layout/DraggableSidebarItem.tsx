"use client";
import React, { useRef, useState } from 'react';
import { useDrag, useDrop } from 'react-dnd';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Icon, IconName } from '@/components/ui/Icon';

interface DraggableSidebarItemProps {
  id: string;
  icon: IconName;
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
}

interface DragItem {
  index: number;
  id: string;
  type: string;
}

/**
 * Simple sidebar navigation item with drag-and-drop support.
 *
 * Layout (collapsed sidebar = 72px with 16px padding = 40px content area):
 * - Collapsed: 40x40 button, centered
 * - Expanded: Full width button with icon + label
 */
const DraggableSidebarItem: React.FC<DraggableSidebarItemProps> = ({
  id,
  icon: iconName,
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
  const [isPressed, setIsPressed] = useState(false);

  if (!id || !iconName || !label) return null;

  // Drag and drop setup
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
      className={cn(
        "relative group overflow-visible",
        // Collapsed: shrink to fit button, Expanded: full width
        showContent ? "w-full" : "w-10",
        isDragging && "opacity-40"
      )}
      data-handler-id={handlerId}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
    >
      <button
        onClick={() => onClick?.()}
        onMouseEnter={onMouseEnter}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        className={cn(
          // Base styles - overflow-visible to prevent icon clipping during hover animation
          "h-10 flex items-center rounded-lg cursor-pointer border-0 bg-transparent overflow-visible",
          "transition-colors duration-150",
          // Width: collapsed = 40px square, expanded = full width
          showContent ? "w-full px-3" : "w-10 justify-center",
          // Active state
          isActive && [
            "bg-accent-15 text-accent",
            "hover:bg-accent-25"
          ],
          // Inactive state
          !isActive && [
            "text-muted-foreground",
            "hover:text-foreground hover:bg-muted"
          ]
        )}
        title={!showContent ? label : undefined}
        aria-label={label}
      >
        {/* Icon - Icon component now handles its own sizing */}
        <motion.div
          className="flex-shrink-0 overflow-visible"
          animate={{
            scale: isPressed ? 0.9 : isHovered ? 1.1 : 1,
          }}
          transition={{ type: "spring", stiffness: 400, damping: 20 }}
        >
          <Icon
            name={iconName}
            size={20}
            weight="regular"
            className={isActive ? "text-accent" : undefined}
          />
        </motion.div>

        {/* Label - only when expanded */}
        {showContent && (
          <span className="ml-3 text-sm font-medium truncate leading-5">
            {label}
          </span>
        )}

        {/* Status indicators (children) */}
        {children}
      </button>

      {/* Drag handle - expanded + hovered only */}
      {showContent && isHovered && isDragEnabled && (
        <Icon
          name="GripVertical"
          size={16}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40"
        />
      )}
    </div>
  );
};

export default DraggableSidebarItem;
