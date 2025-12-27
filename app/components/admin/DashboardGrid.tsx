"use client";

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Icon } from '@/components/ui/Icon';

// Import CSS for react-grid-layout
import 'react-grid-layout/css/styles.css';

// Widget layout interface
interface WidgetLayout {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  static?: boolean;
}

interface DashboardGridProps {
  children: React.ReactNode;
  layouts: any;
  onLayoutChange: (layout: WidgetLayout[], layouts: any) => void;
  isMobile: boolean;
}

// Temporarily disabled - causing lazy loading issues
// TODO: Fix react-grid-layout dynamic import
const ResponsiveGridLayout = () => (
  <div className="h-64 flex items-center justify-center">
    <div className="text-muted-foreground">Grid layout temporarily disabled</div>
  </div>
);

export function DashboardGrid({ children, layouts, onLayoutChange, isMobile }: DashboardGridProps) {
  const [mounted, setMounted] = useState(false);
  const [width, setWidth] = useState(1200);

  // Ensure component is mounted before rendering grid
  useEffect(() => {
    setMounted(true);

    // Set initial width and listen for resize
    const updateWidth = () => {
      setWidth(window.innerWidth);
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Breakpoints for responsive grid
  const breakpoints = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
  const cols = { lg: 12, md: 12, sm: 12, xs: 12, xxs: 12 };

  if (!mounted) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Icon name="Loader" size={24} />
      </div>
    );
  }

  return (
    <div className="dashboard-grid">
      <ResponsiveGridLayout
        className="layout"
        layouts={layouts}
        onLayoutChange={onLayoutChange}
        breakpoints={breakpoints}
        cols={cols}
        rowHeight={100}
        width={width}
        margin={isMobile ? [8, 8] : [16, 16]}
        containerPadding={[0, 0]}
        isDraggable={!isMobile}
        isResizable={!isMobile}
        useCSSTransforms={true}
        compactType="vertical"
        preventCollision={false}
      >
        {children}
      </ResponsiveGridLayout>
    </div>
  );
}