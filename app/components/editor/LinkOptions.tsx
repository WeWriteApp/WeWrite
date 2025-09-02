import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';

interface LinkOptionsProps {
  // State
  customText: boolean;
  showAuthor: boolean;
  displayText: string;
  
  // Actions
  onCustomTextToggle: (enabled: boolean) => void;
  onShowAuthorToggle: (enabled: boolean) => void;
  onDisplayTextChange: (text: string) => void;
  onResetToDefault: () => void;
  
  // Configuration
  showAuthorOption?: boolean;
  defaultTextPlaceholder?: string;
  className?: string;
}

/**
 * Reusable link options component
 * Handles custom text and show author toggles with consistent UI
 */
export function LinkOptions({
  customText,
  showAuthor,
  displayText,
  onCustomTextToggle,
  onShowAuthorToggle,
  onDisplayTextChange,
  onResetToDefault,
  showAuthorOption = true,
  defaultTextPlaceholder = "Enter custom display text",
  className = ""
}: LinkOptionsProps) {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Custom Text Toggle */}
      <div className="flex items-center justify-between">
        <Label htmlFor="custom-text" className="text-sm font-medium">
          Custom link text
        </Label>
        <Switch
          id="custom-text"
          checked={customText}
          onCheckedChange={onCustomTextToggle}
        />
      </div>

      {/* Show Author Toggle - Only show if enabled */}
      {showAuthorOption && (
        <div className="flex items-center justify-between">
          <Label htmlFor="show-author" className="text-sm font-medium">
            Show author
          </Label>
          <Switch
            id="show-author"
            checked={showAuthor}
            onCheckedChange={onShowAuthorToggle}
          />
        </div>
      )}

      {/* Custom Text Input - Only show when enabled */}
      {customText && (
        <div className="space-y-2">
          <Input
            id="display-text"
            value={displayText}
            onChange={(e) => onDisplayTextChange(e.target.value)}
            placeholder={defaultTextPlaceholder}
            className="w-full min-w-0"
            autoComplete="off"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResetToDefault}
            className="text-xs"
          >
            Reset to default
          </Button>
        </div>
      )}
    </div>
  );
}
