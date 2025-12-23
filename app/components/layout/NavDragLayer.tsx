"use client"

import React from 'react';
import { useDragLayer } from 'react-dnd';
import { cn } from '../../lib/utils';
import { Icon, IconName } from '@/components/ui/Icon';

const DRAG_TYPE = 'unified-nav-item';

// Icon mapping
const iconMap: Record<string, IconName> = {
  home: 'Home',
  search: 'Search',
  notifications: 'Bell',
  profile: 'User',
  'random-pages': 'Shuffle',
  'trending-pages': 'TrendingUp',
  recents: 'Clock',
  following: 'Heart',
  settings: 'Settings',
  admin: 'Shield',
};

const labelMap: Record<string, string> = {
  home: 'Home',
  search: 'Search',
  notifications: 'Alerts',
  profile: 'Profile',
  'random-pages': 'Random',
  'trending-pages': 'Trending',
  recents: 'Recents',
  following: 'Following',
  settings: 'Settings',
  admin: 'Admin',
};

/**
 * Custom drag layer that renders a ghost preview of the dragged item
 * following the cursor/touch position
 */
export default function NavDragLayer() {
  const { isDragging, item, currentOffset } = useDragLayer((monitor) => ({
    item: monitor.getItem(),
    currentOffset: monitor.getSourceClientOffset(),
    isDragging: monitor.isDragging(),
  }));

  if (!isDragging || !currentOffset || !item) {
    return null;
  }

  const iconName = iconMap[item.id] || 'Home';
  const label = labelMap[item.id] || item.id;

  return (
    <div
      style={{
        position: 'fixed',
        pointerEvents: 'none',
        zIndex: 9999,
        left: 0,
        top: 0,
        transform: `translate(${currentOffset.x - 40}px, ${currentOffset.y - 30}px)`,
      }}
    >
      <div
        className={cn(
          "flex flex-col items-center justify-center w-16 h-11 rounded-lg py-0.5 px-1 gap-0.5",
          "bg-background/95 backdrop-blur-sm",
          "shadow-lg border border-primary/30",
          "text-foreground",
          "scale-105"
        )}
      >
        <Icon name={iconName} size={20} />
        <span className="text-[10px] font-medium leading-tight text-center">
          {label}
        </span>
      </div>
    </div>
  );
}
