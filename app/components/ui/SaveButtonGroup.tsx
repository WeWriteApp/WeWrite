"use client";

import React from 'react';
import { Button } from './button';
import { Check, RotateCcw } from 'lucide-react';
import { cn } from '../../lib/utils';

/**
 * Reusable save button group component
 * 
 * Provides consistent save/revert button styling and behavior
 * across different contexts (header, footer, modals, etc.)
 */

export interface SaveButtonGroupProps {
  // Core functionality
  onSave: () => void;
  onRevert: () => void;
  isSaving?: boolean;
  disabled?: boolean;
  
  // Button text customization
  saveText?: string;
  revertText?: string;
  savingText?: string;
  
  // Layout options
  layout?: 'horizontal' | 'vertical' | 'responsive';
  alignment?: 'left' | 'center' | 'right' | 'space-between';
  size?: 'sm' | 'default' | 'lg';
  
  // Style variants
  variant?: 'default' | 'header' | 'footer' | 'modal';
  fullWidth?: boolean;
  
  // Additional styling
  className?: string;
  gap?: 'sm' | 'default' | 'lg';
}

/**
 * SaveButtonGroup Component
 */
export function SaveButtonGroup({
  onSave,
  onRevert,
  isSaving = false,
  disabled = false,
  saveText = "Save",
  revertText = "Revert", 
  savingText = "Saving...",
  layout = 'horizontal',
  alignment = 'center',
  size = 'default',
  variant = 'default',
  fullWidth = false,
  className,
  gap = 'default'
}: SaveButtonGroupProps) {
  
  // Style configurations for different variants
  const variantStyles = {
    default: {
      container: 'bg-background border border-border rounded-lg p-3',
      saveButton: 'bg-primary text-primary-foreground hover:bg-primary/90',
      revertButton: 'border border-border hover:bg-accent'
    },
    header: {
      container: 'bg-green-600 text-white',
      saveButton: 'bg-white text-green-600 hover:bg-gray-100',
      revertButton: 'text-white hover:bg-green-700 border border-white/30 hover:border-white/50'
    },
    footer: {
      container: 'bg-green-600 text-white rounded-lg p-4',
      saveButton: 'bg-white text-green-600 hover:bg-gray-100',
      revertButton: 'text-white hover:bg-green-700 border border-white/30 hover:border-white/50'
    },
    modal: {
      container: 'bg-background',
      saveButton: 'bg-primary text-primary-foreground hover:bg-primary/90',
      revertButton: 'border border-border hover:bg-accent'
    }
  };
  
  // Layout classes
  const layoutClasses = {
    horizontal: 'flex flex-row',
    vertical: 'flex flex-col',
    responsive: 'flex flex-col md:flex-row'
  };
  
  // Alignment classes
  const alignmentClasses = {
    left: 'justify-start',
    center: 'justify-center',
    right: 'justify-end',
    'space-between': 'justify-between'
  };
  
  // Gap classes
  const gapClasses = {
    sm: 'gap-2',
    default: 'gap-3',
    lg: 'gap-4'
  };
  
  // Button width classes
  const buttonWidthClasses = fullWidth ? 'flex-1' : '';
  
  const styles = variantStyles[variant];
  
  return (
    <div className={cn(
      styles.container,
      layoutClasses[layout],
      alignmentClasses[alignment],
      gapClasses[gap],
      className
    )}>
      {/* Revert Button */}
      <Button
        variant="ghost"
        size={size}
        className={cn(
          'gap-2 font-medium rounded-lg',
          styles.revertButton,
          buttonWidthClasses
        )}
        onClick={onRevert}
        disabled={disabled || isSaving}
      >
        <RotateCcw className="h-4 w-4" />
        {revertText}
      </Button>
      
      {/* Save Button */}
      <Button
        variant="secondary"
        size={size}
        className={cn(
          'gap-2 font-medium rounded-lg',
          styles.saveButton,
          buttonWidthClasses
        )}
        onClick={onSave}
        disabled={disabled || isSaving}
      >
        <Check className="h-4 w-4" />
        {isSaving ? savingText : saveText}
      </Button>
    </div>
  );
}

/**
 * Specialized variants for common use cases
 */

export function HeaderSaveButtons(props: Omit<SaveButtonGroupProps, 'variant'>) {
  return (
    <SaveButtonGroup
      {...props}
      variant="header"
      layout="responsive"
      alignment="right"
      fullWidth={true}
      className="md:ml-auto md:w-auto"
    />
  );
}

export function FooterSaveButtons(props: Omit<SaveButtonGroupProps, 'variant'>) {
  return (
    <SaveButtonGroup
      {...props}
      variant="footer"
      layout="responsive"
      alignment="center"
      size="lg"
      saveText="Save Changes"
      revertText="Revert Changes"
    />
  );
}

export function ModalSaveButtons(props: Omit<SaveButtonGroupProps, 'variant'>) {
  return (
    <SaveButtonGroup
      {...props}
      variant="modal"
      layout="horizontal"
      alignment="right"
      gap="sm"
    />
  );
}

export default SaveButtonGroup;
