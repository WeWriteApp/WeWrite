"use client";
import { Icon } from "@iconify/react";
import { cn } from "../lib/utils";

export default function SearchInput({ 
  value, 
  onChange, 
  placeholder = "Search...", 
  className,
  disabled = false
}) {
  return (
    <div className={cn(
      "relative flex items-center",
      disabled && "opacity-50",
      className
    )}>
      <Icon 
        icon="ph:magnifying-glass" 
        className="absolute left-3 w-5 h-5 text-muted-foreground"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-full pl-10 pr-4 py-2 rounded-md border border-input",
          "bg-background text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-primary/50",
          "placeholder:text-muted-foreground",
          "disabled:cursor-not-allowed"
        )}
      />
    </div>
  );
} 