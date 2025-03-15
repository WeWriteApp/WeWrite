"use client";
import { Icon } from "@iconify/react";
import { cn } from "../lib/utils";

export default function SearchInput({ 
  value, 
  onChange, 
  placeholder = "Search...", 
  className 
}) {
  return (
    <div className={cn(
      "relative flex items-center",
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
        className={cn(
          "w-full pl-10 pr-4 py-2 rounded-md border border-input",
          "bg-background text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-primary/50",
          "placeholder:text-muted-foreground"
        )}
      />
    </div>
  );
} 