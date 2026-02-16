import React from 'react';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '../../../components/ui/table';
import { DraggableColumnHeader } from './DraggableColumnHeader';
import type { User, Column } from '../types';

interface UsersTableProps {
  activeColumns: Column[];
  sorted: User[];
  sortBy: { id: string; dir: "asc" | "desc" } | null;
  moveColumn: (dragIndex: number, hoverIndex: number) => void;
  handleSort: (id: string, sortable?: boolean) => void;
  onUserSelect: (user: User) => void;
}

export function UsersTable({
  activeColumns,
  sorted,
  sortBy,
  moveColumn,
  handleSort,
  onUserSelect,
}: UsersTableProps) {
  return (
    <div className="overflow-x-auto">
      <Table
        className="hidden md:table border-separate table-fixed"
        style={{ borderSpacing: '8px 0' }}
      >
        <TableHeader className="sticky top-0 z-30 bg-background">
          <TableRow className="[&>th]:px-3 [&>th]:py-3 [&>th]:align-top">
            {activeColumns.map((col, index) => (
              <DraggableColumnHeader
                key={col.id}
                column={col}
                index={index}
                moveColumn={moveColumn}
                sortBy={sortBy}
                onSort={handleSort}
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className="[&>tr>td]:px-3 [&>tr>td]:py-3 [&>tr>td]:align-top">
          {sorted.map((u) => (
            <TableRow
              key={u.uid}
              className="cursor-pointer hover:bg-muted/40"
              onClick={() => onUserSelect(u)}
            >
              {activeColumns.map((col) => (
                <TableCell
                  key={col.id}
                  className="whitespace-nowrap"
                  style={{
                    width: col.minWidth ? `${col.minWidth}px` : 'auto',
                    minWidth: col.minWidth ? `${col.minWidth}px` : '80px'
                  }}
                >
                  {col.render(u)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
