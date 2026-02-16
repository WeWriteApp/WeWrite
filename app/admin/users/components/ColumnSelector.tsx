import React from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../../components/ui/dropdown-menu';
import type { Column } from '../types';

interface ColumnSelectorProps {
  columns: Column[];
  visibleColumns: string[];
  draggedColumnId: string | null;
  setDraggedColumnId: (id: string | null) => void;
  dragOverColumnId: string | null;
  setDragOverColumnId: (id: string | null) => void;
  toggleColumn: (id: string) => void;
  reorderColumn: (fromId: string, toId: string) => void;
}

export function ColumnSelector({
  columns,
  visibleColumns,
  draggedColumnId,
  setDraggedColumnId,
  dragOverColumnId,
  setDragOverColumnId,
  toggleColumn,
  reorderColumn,
}: ColumnSelectorProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Icon name="Columns3" size={16} className="mr-2" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Visible columns</span>
          <span className="text-xs text-muted-foreground font-normal">Drag to reorder</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-80 overflow-auto py-1">
          {visibleColumns.map((colId) => {
            const col = columns.find((c) => c.id === colId);
            if (!col) return null;
            return (
              <div
                key={col.id}
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  setDraggedColumnId(col.id);
                  e.dataTransfer.effectAllowed = 'move';
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (draggedColumnId && draggedColumnId !== col.id) {
                    setDragOverColumnId(col.id);
                  }
                }}
                onDragLeave={() => {
                  setDragOverColumnId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (draggedColumnId && draggedColumnId !== col.id) {
                    reorderColumn(draggedColumnId, col.id);
                  }
                  setDraggedColumnId(null);
                  setDragOverColumnId(null);
                }}
                onDragEnd={() => {
                  setDraggedColumnId(null);
                  setDragOverColumnId(null);
                }}
                className={`
                  flex items-center gap-2 px-2 py-1.5 rounded-md cursor-grab active:cursor-grabbing
                  transition-all duration-150
                  ${draggedColumnId === col.id ? 'opacity-50 scale-95' : ''}
                  ${dragOverColumnId === col.id ? 'bg-accent/50 ring-2 ring-primary/30' : 'hover:bg-accent/50'}
                `}
                onClick={(e) => e.stopPropagation()}
              >
                <Icon name="GripVertical" size={14} className="text-muted-foreground flex-shrink-0" />
                <Checkbox
                  checked={true}
                  onCheckedChange={() => toggleColumn(col.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                <span className="text-sm flex-1">{col.label}</span>
              </div>
            );
          })}

          {columns.filter(c => !visibleColumns.includes(c.id)).length > 0 && (
            <>
              <DropdownMenuSeparator className="my-2" />
              <div className="px-2 py-1 text-xs text-muted-foreground">Hidden columns</div>
              {columns.filter(c => !visibleColumns.includes(c.id)).map((col) => (
                <div
                  key={col.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent/50 transition-colors"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="w-[14px]" />
                  <Checkbox
                    checked={false}
                    onCheckedChange={() => toggleColumn(col.id)}
                  />
                  <span className="text-sm text-muted-foreground flex-1">{col.label}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
