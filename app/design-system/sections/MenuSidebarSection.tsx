"use client";

import React, { useState } from 'react';
import { Icon, IconName } from '@/components/ui/Icon';
import { ComponentShowcase, StateDemo } from './shared';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

// Simplified sidebar item for demonstration (based on DraggableSidebarItem)
function SidebarItem({
  icon,
  label,
  isActive = false,
  showContent = true,
  onClick,
}: {
  icon: IconName;
  label: string;
  isActive?: boolean;
  showContent?: boolean;
  onClick?: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => { setIsHovered(false); setIsPressed(false); }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      className={cn(
        "h-10 flex items-center rounded-lg cursor-pointer border-0",
        "transition-all duration-200 ease-out",
        showContent
          ? "w-full pl-3 pr-2 bg-transparent"
          : "w-10 justify-center bg-transparent",
        // Active state - accent color with alpha overlay for hover/pressed
        // NOTE: Use custom bg-accent-* classes (uses --accent-base, the vibrant color)
        // NOT Tailwind's bg-accent/* (uses --accent, which is a neutral gray)
        isActive && [
          "bg-accent-15 text-accent",
          "hover:bg-accent-25",
          "active:bg-accent-35 active:scale-[0.98] active:duration-75"
        ],
        // Non-active states - hover and click feedback
        !isActive && [
          "text-muted-foreground",
          "hover:text-foreground hover:bg-alpha-10",
          "active:bg-alpha-15 active:scale-[0.98] active:duration-75"
        ]
      )}
      title={!showContent ? label : undefined}
      aria-label={label}
    >
      <motion.div
        className="flex items-center justify-center"
        style={{ width: 20, height: 20 }}
        animate={{
          scale: isPressed ? 0.9 : isHovered ? 1.15 : isActive ? 1.05 : 1,
        }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <Icon
          name={icon}
          size={20}
          className={cn(
            "flex-shrink-0",
            isActive && "text-accent"
          )}
        />
      </motion.div>

      <span
        className={cn(
          "text-sm font-medium truncate whitespace-nowrap overflow-hidden leading-5",
          "transition-all duration-300 ease-out",
          showContent
            ? "ml-3 opacity-100 w-auto max-w-[160px]"
            : "ml-0 opacity-0 w-0 max-w-0"
        )}
      >
        {label}
      </span>
    </button>
  );
}

export function MenuSidebarSection({ id }: { id: string }) {
  const [activeItem, setActiveItem] = useState('home');
  const [isExpanded, setIsExpanded] = useState(true);

  const menuItems = [
    { id: 'home', icon: 'Home' as IconName, label: 'Home' },
    { id: 'pages', icon: 'FileText' as IconName, label: 'Pages' },
    { id: 'users', icon: 'Users' as IconName, label: 'Users' },
    { id: 'analytics', icon: 'BarChart3' as IconName, label: 'Analytics' },
    { id: 'notifications', icon: 'Bell' as IconName, label: 'Notifications' },
    { id: 'settings', icon: 'Settings' as IconName, label: 'Settings' },
  ];

  return (
    <ComponentShowcase
      id={id}
      title="Menu (Sidebar)"
      path="app/components/layout/DraggableSidebarItem.tsx"
      description="Sidebar navigation items with icon animations, hover/pressed states using alpha tokens, and support for collapsed/expanded modes."
    >
      <StateDemo label="Expanded Sidebar">
        <div className="wewrite-card p-2 w-56 space-y-1">
          {menuItems.map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              isActive={activeItem === item.id}
              showContent={true}
              onClick={() => setActiveItem(item.id)}
            />
          ))}
        </div>
      </StateDemo>

      <StateDemo label="Collapsed Sidebar">
        <div className="wewrite-card p-2 w-14 space-y-1 flex flex-col items-center">
          {menuItems.slice(0, 4).map((item) => (
            <SidebarItem
              key={item.id}
              icon={item.icon}
              label={item.label}
              isActive={activeItem === item.id}
              showContent={false}
              onClick={() => setActiveItem(item.id)}
            />
          ))}
        </div>
      </StateDemo>

      <StateDemo label="Item States">
        <div className="flex flex-wrap gap-4">
          <div className="wewrite-card p-2 w-48">
            <p className="text-xs text-muted-foreground mb-2 px-2">Default</p>
            <SidebarItem icon="FileText" label="Default Item" />
          </div>
          <div className="wewrite-card p-2 w-48">
            <p className="text-xs text-muted-foreground mb-2 px-2">Active</p>
            <SidebarItem icon="FileText" label="Active Item" isActive />
          </div>
        </div>
      </StateDemo>

      <StateDemo label="With Sections">
        <div className="wewrite-card p-2 w-56 space-y-1">
          <p className="text-xs text-muted-foreground px-3 py-2 font-medium">Main</p>
          <SidebarItem icon="Home" label="Home" isActive />
          <SidebarItem icon="Search" label="Search" />
          <SidebarItem icon="Star" label="Favorites" />

          <div className="h-px bg-border my-2" />

          <p className="text-xs text-muted-foreground px-3 py-2 font-medium">Workspace</p>
          <SidebarItem icon="Folder" label="Projects" />
          <SidebarItem icon="Calendar" label="Calendar" />
          <SidebarItem icon="Mail" label="Messages" />

          <div className="h-px bg-border my-2" />

          <SidebarItem icon="Settings" label="Settings" />
          <SidebarItem icon="HelpCircle" label="Help" />
        </div>
      </StateDemo>

      <StateDemo label="Interaction Details">
        <div className="wewrite-card p-4 max-w-2xl">
          <h4 className="font-medium mb-2">Hover States</h4>
          <ul className="text-sm text-muted-foreground space-y-1 mb-4">
            <li>Default: <code className="bg-muted px-1 rounded">hover:bg-alpha-10 hover:text-foreground</code></li>
            <li>Active: <code className="bg-muted px-1 rounded">hover:bg-accent-25</code> (stronger than base bg-accent-15)</li>
            <li>Icon: <code className="bg-muted px-1 rounded">scale(1.15) translateY(-1px)</code> on button hover</li>
          </ul>

          <h4 className="font-medium mb-2">Pressed States</h4>
          <ul className="text-sm text-muted-foreground space-y-1 mb-4">
            <li>Default: <code className="bg-muted px-1 rounded">active:bg-alpha-15 active:scale-[0.98]</code></li>
            <li>Active: <code className="bg-muted px-1 rounded">active:bg-accent-35 active:scale-[0.98]</code></li>
            <li>Icon: <code className="bg-muted px-1 rounded">scale(0.9)</code> on button press</li>
            <li>Duration: 75ms for press feedback</li>
          </ul>

          <h4 className="font-medium mb-2 text-error">Important: Accent Color Tokens</h4>
          <ul className="text-sm text-muted-foreground space-y-1 mb-4">
            <li className="text-error font-medium">Use custom <code className="bg-muted px-1 rounded">bg-accent-15</code> NOT Tailwind's <code className="bg-muted px-1 rounded">bg-accent/15</code></li>
            <li><code className="bg-muted px-1 rounded">--accent</code> = neutral gray (for Tailwind's accent role)</li>
            <li><code className="bg-muted px-1 rounded">--accent-base</code> = vibrant user color (what you want)</li>
            <li>Custom classes: <code className="bg-muted px-1 rounded">bg-accent-15</code>, <code className="bg-muted px-1 rounded">bg-accent-25</code>, <code className="bg-muted px-1 rounded">bg-accent-35</code>, etc.</li>
          </ul>

          <h4 className="font-medium mb-2">Alpha Tokens</h4>
          <ul className="text-sm text-muted-foreground space-y-1 mb-4">
            <li><code className="bg-muted px-1 rounded">bg-alpha-10</code> - 10% contrast overlay for hover</li>
            <li><code className="bg-muted px-1 rounded">bg-alpha-15</code> - 15% contrast overlay for pressed</li>
            <li>Light mode: rgba(0,0,0,opacity) - black on white</li>
            <li>Dark mode: rgba(255,255,255,opacity) - white on black</li>
          </ul>

          <h4 className="font-medium mb-2">Expand/Collapse</h4>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>Expanded: Full width with icon + label</li>
            <li>Collapsed: 40x40 button with icon only</li>
            <li>Label uses <code className="bg-muted px-1 rounded">max-width</code> animation for smooth transitions</li>
            <li>Icon position stays constant during expand/collapse</li>
          </ul>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
