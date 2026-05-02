"use client";

import { Button } from "./button";
import { Icon } from "./Icon";

export type SortDirection = "asc" | "desc";

interface SortableTableHeaderProps {
  label: string;
  isActive: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: "left" | "right";
}

export function SortableTableHeader({
  label,
  isActive,
  direction,
  onClick,
  align = "left",
}: SortableTableHeaderProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`h-auto p-0 w-full font-medium text-muted-foreground hover:bg-transparent ${align === "right" ? "justify-end" : "justify-start"}`}
    >
      <span>{label}</span>
      {isActive ? (
        <Icon name={direction === "asc" ? "ChevronUp" : "ChevronDown"} size={14} className="ml-1" />
      ) : (
        <Icon name="ArrowUpDown" size={14} className="ml-1 opacity-50" />
      )}
    </Button>
  );
}
