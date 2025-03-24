import React, { useState, useRef, useEffect } from "react";
import { X, Search, Check } from "lucide-react";
import { Badge } from "./badge";
import { Input } from "./input";

interface Item {
  id: string;
  label: string;
}

interface MultiSelectProps {
  items: Item[];
  selectedItems: Item[];
  onItemSelect: (item: Item) => void;
  onItemRemove: (item: Item) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  className?: string;
  onSearch?: (query: string) => void;
  loading?: boolean;
}

export function MultiSelect({
  items,
  selectedItems,
  onItemSelect,
  onItemRemove,
  placeholder = "Select items...",
  searchPlaceholder = "Search...",
  className = "",
  onSearch,
  loading = false,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  // Filter items based on search query and exclude already selected items
  const filteredItems = items.filter(
    (item) =>
      item.label.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !selectedItems.some((selected) => selected.id === item.id)
  );

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    if (onSearch) {
      onSearch(query);
    }
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div
        className="flex flex-wrap gap-1 p-2 border border-input rounded-md min-h-10 cursor-text"
        onClick={() => setIsOpen(true)}
      >
        {selectedItems.length === 0 && !isOpen && (
          <span className="text-muted-foreground self-center">{placeholder}</span>
        )}
        
        {selectedItems.map((item) => (
          <Badge key={item.id} variant="secondary" className="flex items-center gap-1">
            {item.label}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onItemRemove(item);
              }}
              className="rounded-full hover:bg-muted p-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        
        {isOpen && (
          <Input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
            className="flex-1 border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-w-[120px]"
            autoFocus
          />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-60 overflow-auto">
          {loading ? (
            <div className="p-2 text-center text-muted-foreground">Loading...</div>
          ) : filteredItems.length === 0 ? (
            <div className="p-2 text-center text-muted-foreground">No results found</div>
          ) : (
            <ul>
              {filteredItems.map((item) => (
                <li
                  key={item.id}
                  className="px-2 py-1.5 hover:bg-accent cursor-pointer flex items-center gap-2"
                  onClick={() => {
                    onItemSelect(item);
                    setSearchQuery("");
                  }}
                >
                  <span className="w-5 h-5 flex items-center justify-center">
                    <Check className="h-4 w-4 opacity-0" />
                  </span>
                  {item.label}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
