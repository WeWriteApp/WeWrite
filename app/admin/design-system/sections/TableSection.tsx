"use client";

import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { Badge } from '../../../components/ui/badge';
import { ComponentShowcase, StateDemo } from './shared';

export function TableSection({ id }: { id: string }) {
  return (
    <ComponentShowcase
      id={id}
      title="Table"
      path="app/components/ui/table.tsx"
      description="Data table component with proper border styling using border-theme-strong class"
    >
      <StateDemo label="Basic Table">
        <div className="w-full">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Alice Johnson</TableCell>
                <TableCell>
                  <Badge variant="default">Active</Badge>
                </TableCell>
                <TableCell className="text-right">$250.00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Bob Smith</TableCell>
                <TableCell>
                  <Badge variant="secondary">Pending</Badge>
                </TableCell>
                <TableCell className="text-right">$150.00</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-medium">Carol White</TableCell>
                <TableCell>
                  <Badge variant="outline">Inactive</Badge>
                </TableCell>
                <TableCell className="text-right">$350.00</TableCell>
              </TableRow>
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-right font-bold">$750.00</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </StateDemo>

      <StateDemo label="Border Classes">
        <div className="space-y-2 text-sm">
          <div className="flex gap-2 items-center">
            <code className="px-2 py-1 bg-muted rounded text-xs">border-theme-strong</code>
            <span className="text-muted-foreground">- For header/footer rows (60% opacity)</span>
          </div>
          <div className="flex gap-2 items-center">
            <code className="px-2 py-1 bg-muted rounded text-xs">border-b border-border</code>
            <span className="text-muted-foreground">- For body rows (uses --border variable)</span>
          </div>
        </div>
      </StateDemo>
    </ComponentShowcase>
  );
}
