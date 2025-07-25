'use client';

import React from 'react';
import { Switch } from '../ui/switch';
import { useLineSettings, LINE_MODES } from '../../contexts/LineSettingsContext';

interface DenseModeToggleProps {
  className?: string;
}

/**
 * DenseModeToggle - Switch between normal and dense viewing modes
 *
 * This component allows users to switch between normal paragraph view
 * and dense continuous text view for better reading experience.
 * Only available in viewing mode, not editing mode.
 */
const DenseModeToggle: React.FC<DenseModeToggleProps> = ({
  className = ''
}) => {
  const { lineMode, setLineMode, isEditMode } = useLineSettings();

  // Don't show toggle in edit mode
  if (isEditMode) {
    return null;
  }

  const isDense = lineMode === LINE_MODES.DENSE;

  const handleToggle = (checked: boolean) => {
    const newMode = checked ? LINE_MODES.DENSE : LINE_MODES.NORMAL;
    setLineMode(newMode);
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <label
        htmlFor="dense-mode-switch"
        className="text-sm font-medium text-muted-foreground cursor-pointer"
      >
        Dense mode
      </label>
      <Switch
        id="dense-mode-switch"
        checked={isDense}
        onCheckedChange={handleToggle}
        aria-label="Toggle dense mode"
      />
    </div>
  );
};

export default DenseModeToggle;
