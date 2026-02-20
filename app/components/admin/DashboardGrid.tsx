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

// Dynamic import of react-grid-layout to avoid SSR issues
const ResponsiveGridLayout = dynamic(
  () => import('react-grid-layout').then(mod => {
    const { WidthProvider, Responsive } = mod;
    return WidthProvider(Responsive);
  }),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 flex items-center justify-center">
        <Icon name="Loader" size={24} />
      </div>
    )
  }
);

export function DashboardGrid({ children, layouts, onLayoutChange, isMobile }: DashboardGridProps) {
  const [mounted, setMounted] = useState(false);

  // Ensure component is mounted before rendering grid
  useEffect(() => {
    setMounted(true);
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
