"use client";

import React from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

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

  // Call all hooks unconditionally (Rules of Hooks)
  const accountsResult = useAccountsMetrics(dateRange, granularity);
  const pagesResult = usePagesMetrics(dateRange, granularity);
  const sharesResult = useSharesMetrics(dateRange, granularity);
  const editsResult = useEditsMetrics(dateRange, granularity);
  const contentChangesResult = useContentChangesMetrics(dateRange, granularity);
  const pwaInstallsResult = usePWAInstallsMetrics(dateRange, granularity);
  const visitorsResult = useVisitorMetrics(dateRange, granularity);

  // Select the appropriate result based on item type
  let data: any[] = [];
  let loading = false;
  let error: string | null = null;

  switch (item.id) {
    case 'new-accounts':
      data = accountsResult.data;
      loading = accountsResult.loading;
      error = accountsResult.error;
      break;
    case 'new-pages':
      data = pagesResult.data;
      loading = pagesResult.loading;
      error = pagesResult.error;
      break;
    case 'shares':
      data = sharesResult.data;
      loading = sharesResult.loading;
      error = sharesResult.error;
      break;
    case 'edits':
      data = editsResult.data;
      loading = editsResult.loading;
      error = editsResult.error;
      break;
    case 'content-changes':
      data = contentChangesResult.data;
      loading = contentChangesResult.loading;
      error = contentChangesResult.error;
      break;
    case 'pwa-installs':
      data = pwaInstallsResult.data;
      loading = pwaInstallsResult.loading;
      error = pwaInstallsResult.error;
      break;
    case 'visitors':
      data = visitorsResult.data;
      loading = visitorsResult.loading;
      error = visitorsResult.error;
      break;
    default:
      data = [];
      loading = false;
      error = null;
  }

  // Convert data to sparkline format
  const sparklineData = convertToSparklineData(data, item.sparklineValueKey || 'value');

  // Debug logging for data issues
  console.log(`📊 [DashboardListMode] ${item.id} data:`, {
    dataLength: data?.length || 0,
    loading,
    error,
    sampleData: data?.slice(0, 2)
  });

  // Calculate current value
  let currentValue = '0';
  if (data && data.length > 0) {
    if (item.valueFormatter) {
      currentValue = item.valueFormatter(data);
    } else {
      // Use the sparklineValueKey to determine which field to sum
      const valueKey = item.sparklineValueKey || 'value';
      const total = data.reduce((sum, dataItem) => sum + (dataItem[valueKey] || 0), 0);
      currentValue = formatSparklineValue(total, item.sparklineType);
    }
  } else if (loading) {
    currentValue = 'Loading...';
  } else if (error) {
    currentValue = 'Error';
  }

  // Generate subtitle with more detailed information
  let subtitle = '';
  if (loading) {
    subtitle = 'Loading...';
  } else if (error) {
    subtitle = `Error: ${error.substring(0, 50)}`;
  } else if (data && data.length > 0) {
    const timeRange = Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
    subtitle = `${timeRange} day${timeRange !== 1 ? 's' : ''} • ${data.length} data points`;
  } else {
    const timeRange = Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24));
    subtitle = `No data for ${timeRange} day${timeRange !== 1 ? 's' : ''}`;
  }

  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`w-full py-2 px-4 border-b border-border cursor-grab active:cursor-grabbing transition-all duration-200 hover:bg-muted/50 ${isDragging ? 'opacity-50 bg-muted' : ''}`}
    >
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
      <div className="dashboard-list-mode w-full">
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
        const total = data.reduce((sum, item) => sum + (item.count || 0), 0);
        return total.toLocaleString();
      },
      sparklineValueKey: 'count',
      sparklineType: 'number'
    },
    {
      id: 'new-pages',
      label: 'New Pages',
      valueFormatter: (data) => {
        const total = data.reduce((sum, item) => sum + (item.totalPages || 0), 0);
        return total.toLocaleString();
      },
      sparklineValueKey: 'totalPages',
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
