"use client";

import React from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { GripVertical } from 'lucide-react';
import { SparklineWithLabel, convertToSparklineData, formatSparklineValue } from './Sparkline';
import { type DateRange } from './DateRangeFilter';
import { type GlobalAnalyticsFilters } from './GlobalAnalyticsFilters';

// Import hooks for data fetching
import { 
  useAccountsMetrics, 
  usePagesMetrics, 
  useSharesMetrics, 
  useEditsMetrics,
  useContentChangesMetrics,
  usePWAInstallsMetrics,
  useVisitorMetrics
} from '../../hooks/useDashboardAnalytics';

interface DashboardListItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  valueFormatter?: (data: any[]) => string;
  sparklineValueKey?: string;
  sparklineType?: 'number' | 'percentage' | 'currency';
}

interface DraggableListItemProps {
  item: DashboardListItem;
  index: number;
  moveItem: (dragIndex: number, hoverIndex: number) => void;
  dateRange: DateRange;
  granularity: number;
  globalFilters?: GlobalAnalyticsFilters;
}

function DraggableListItem({ item, index, moveItem, dateRange, granularity, globalFilters }: DraggableListItemProps) {
  const [{ isDragging }, drag] = useDrag({
    type: 'list-item',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'list-item',
    hover: (draggedItem: { index: number }) => {
      if (draggedItem.index !== index) {
        moveItem(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
  });

  // Fetch data based on item type
  let data: any[] = [];
  let loading = false;
  let error: string | null = null;

  // Use the appropriate hook based on item ID
  if (item.id === 'new-accounts') {
    const result = useAccountsMetrics(dateRange, granularity);
    data = result.data;
    loading = result.loading;
    error = result.error;
  } else if (item.id === 'new-pages') {
    const result = usePagesMetrics(dateRange, granularity);
    data = result.data;
    loading = result.loading;
    error = result.error;
  } else if (item.id === 'shares') {
    const result = useSharesMetrics(dateRange, granularity);
    data = result.data;
    loading = result.loading;
    error = result.error;
  } else if (item.id === 'edits') {
    const result = useEditsMetrics(dateRange, granularity);
    data = result.data;
    loading = result.loading;
    error = result.error;
  } else if (item.id === 'content-changes') {
    const result = useContentChangesMetrics(dateRange, granularity);
    data = result.data;
    loading = result.loading;
    error = result.error;
  } else if (item.id === 'pwa-installs') {
    const result = usePWAInstallsMetrics(dateRange, granularity);
    data = result.data;
    loading = result.loading;
    error = result.error;
  } else if (item.id === 'visitors') {
    const result = useVisitorMetrics(dateRange, granularity);
    data = result.data;
    loading = result.loading;
    error = result.error;
  }

  // Convert data to sparkline format
  const sparklineData = convertToSparklineData(data, item.sparklineValueKey || 'value');

  // Calculate current value
  let currentValue = '0';
  if (data && data.length > 0) {
    if (item.valueFormatter) {
      currentValue = item.valueFormatter(data);
    } else {
      const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
      currentValue = formatSparklineValue(total, item.sparklineType);
    }
  }

  // Generate subtitle
  let subtitle = '';
  if (loading) {
    subtitle = 'Loading...';
  } else if (error) {
    subtitle = 'Error loading data';
  } else if (data && data.length > 0) {
    const timeRange = Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
    subtitle = `${timeRange} day${timeRange !== 1 ? 's' : ''} • ${data.length} data points`;
  } else {
    subtitle = 'No data available';
  }

  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`relative list-item ${isDragging ? 'opacity-50' : ''}`}
    >
      {/* Drag handle */}
      <div className="absolute left-1 top-1/2 transform -translate-y-1/2 z-10 cursor-grab active:cursor-grabbing drag-handle">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* List item with left padding for drag handle */}
      <div className="pl-8">
        <SparklineWithLabel
          label={item.label}
          value={currentValue}
          subtitle={subtitle}
          icon={item.icon}
          data={sparklineData}
          height={32}
          width={100}
          strokeWidth={1.5}
          showDots={false}
          className="sparkline"
        />
      </div>
    </div>
  );
}

interface DashboardListModeProps {
  dateRange: DateRange;
  granularity: number;
  globalFilters?: GlobalAnalyticsFilters;
  items: DashboardListItem[];
  onItemsReorder: (items: DashboardListItem[]) => void;
}

export function DashboardListMode({
  dateRange,
  granularity,
  globalFilters,
  items,
  onItemsReorder
}: DashboardListModeProps) {
  const moveItem = (dragIndex: number, hoverIndex: number) => {
    const newItems = [...items];
    const [reorderedItem] = newItems.splice(dragIndex, 1);
    newItems.splice(hoverIndex, 0, reorderedItem);
    onItemsReorder(newItems);
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="dashboard-list-mode space-y-3">
        {items.map((item, index) => (
          <DraggableListItem
            key={item.id}
            item={item}
            index={index}
            moveItem={moveItem}
            dateRange={dateRange}
            granularity={granularity}
            globalFilters={globalFilters}
          />
        ))}
      </div>
    </DndProvider>
  );
}

// Default list items configuration
export function createDefaultListItems(dateRange: DateRange, granularity: number): DashboardListItem[] {
  return [
    {
      id: 'new-accounts',
      label: 'New Accounts',
      valueFormatter: (data) => {
        const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
        return total.toLocaleString();
      },
      sparklineValueKey: 'value',
      sparklineType: 'number'
    },
    {
      id: 'new-pages',
      label: 'New Pages',
      valueFormatter: (data) => {
        const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
        return total.toLocaleString();
      },
      sparklineValueKey: 'value',
      sparklineType: 'number'
    },
    {
      id: 'shares',
      label: 'Content Shares',
      valueFormatter: (data) => {
        const total = data.reduce((sum, item) => sum + (item.successful || 0), 0);
        return total.toLocaleString();
      },
      sparklineValueKey: 'successful',
      sparklineType: 'number'
    },
    {
      id: 'edits',
      label: 'Content Edits',
      valueFormatter: (data) => {
        const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
        return total.toLocaleString();
      },
      sparklineValueKey: 'value',
      sparklineType: 'number'
    },
    {
      id: 'content-changes',
      label: 'Content Changes',
      valueFormatter: (data) => {
        const total = data.reduce((sum, item) => sum + (item.added || 0) + (item.deleted || 0), 0);
        return total.toLocaleString();
      },
      sparklineValueKey: 'added',
      sparklineType: 'number'
    },
    {
      id: 'pwa-installs',
      label: 'PWA Installs',
      valueFormatter: (data) => {
        const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
        return total.toLocaleString();
      },
      sparklineValueKey: 'value',
      sparklineType: 'number'
    },
    {
      id: 'visitors',
      label: 'Visitors',
      valueFormatter: (data) => {
        const total = data.reduce((sum, item) => sum + (item.total || 0), 0);
        return total.toLocaleString();
      },
      sparklineValueKey: 'total',
      sparklineType: 'number'
    }
  ];
}
