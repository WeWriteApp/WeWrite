import React, { useRef } from 'react';
import { Icon } from '@/components/ui/Icon';
import { TableHead } from '../../../components/ui/table';
import { useDrag, useDrop } from 'react-dnd';
import type { Column } from '../types';

const COLUMN_TYPE = 'COLUMN';

interface DraggableColumnHeaderProps {
  column: Column;
  index: number;
  moveColumn: (dragIndex: number, hoverIndex: number) => void;
  sortBy: { id: string; dir: "asc" | "desc" } | null;
  onSort: (id: string, sortable?: boolean) => void;
}

export function DraggableColumnHeader({ column, index, moveColumn, sortBy, onSort }: DraggableColumnHeaderProps) {
  const ref = useRef<HTMLTableCellElement>(null);

  const [{ isDragging }, drag] = useDrag({
    type: COLUMN_TYPE,
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: COLUMN_TYPE,
    hover(item: { index: number }, monitor) {
      if (!ref.current) return;
      const dragIndex = item.index;
      const hoverIndex = index;
      if (dragIndex === hoverIndex) return;

      const hoverBoundingRect = ref.current.getBoundingClientRect();
      const hoverMiddleX = (hoverBoundingRect.right - hoverBoundingRect.left) / 2;
      const clientOffset = monitor.getClientOffset();
      if (!clientOffset) return;
      const hoverClientX = clientOffset.x - hoverBoundingRect.left;

      if (dragIndex < hoverIndex && hoverClientX < hoverMiddleX) return;
      if (dragIndex > hoverIndex && hoverClientX > hoverMiddleX) return;

      moveColumn(dragIndex, hoverIndex);
      item.index = hoverIndex;
    },
  });

  drag(drop(ref));

  return (
    <TableHead
      ref={ref}
      className="whitespace-nowrap px-3"
      style={{
        width: column.minWidth ? `${column.minWidth}px` : 'auto',
        minWidth: column.minWidth ? `${column.minWidth}px` : '100px',
        opacity: isDragging ? 0.5 : 1,
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onClick={() => onSort(column.id, column.sortable)}
    >
      <div className="flex items-center gap-1 select-none">
        <span className="truncate">{column.label}</span>
        {column.sortable && (
          sortBy?.id === column.id ? (
            sortBy.dir === "asc" ? (
              <Icon name="ArrowUp" size={12} className="text-muted-foreground flex-shrink-0" />
            ) : (
              <Icon name="ArrowDown" size={12} className="text-muted-foreground flex-shrink-0" />
            )
          ) : (
            <Icon name="ArrowUpDown" size={12} className="text-muted-foreground flex-shrink-0" />
          )
        )}
      </div>
    </TableHead>
  );
}
