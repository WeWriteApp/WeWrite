/**
 * Accessibility Helper Functions
 * 
 * Utility functions to improve accessibility across the WeWrite application.
 * These helpers ensure WCAG 2.1 AA compliance and better screen reader support.
 */

import React, { useEffect, useRef, useState } from 'react';

// Screen reader announcement utility
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite') => {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

// Focus trap utility for modals
export const trapFocus = (event: KeyboardEvent, container: HTMLElement | null) => {
  if (!container) return;
  
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  ) as NodeListOf<HTMLElement>;
  
  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];
  
  if (event.shiftKey) {
    if (document.activeElement === firstFocusable) {
      event.preventDefault();
      lastFocusable.focus();
    }
  } else {
    if (document.activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable.focus();
    }
  }
};

// Hook for managing focus in modals
export const useFocusTrap = (isOpen: boolean) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Store previous focus
      previousFocusRef.current = document.activeElement as HTMLElement;
      
      // Focus first focusable element
      const firstFocusable = containerRef.current?.querySelector(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      ) as HTMLElement;
      
      if (firstFocusable) {
        firstFocusable.focus();
      }
    } else {
      // Restore previous focus
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    }
  }, [isOpen]);

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Tab') {
      trapFocus(event, containerRef.current);
    }
    if (event.key === 'Escape') {
      // Let parent handle escape
      return;
    }
  };

  return { containerRef, handleKeyDown };
};

// Hook for live region announcements
export const useLiveRegion = () => {
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'polite' | 'assertive'>('polite');

  const announce = (text: string, urgency: 'polite' | 'assertive' = 'polite') => {
    setPriority(urgency);
    setMessage(text);
    
    // Clear message after announcement
    setTimeout(() => setMessage(''), 100);
  };

  const LiveRegion = () => (
    <div
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );

  return { announce, LiveRegion };
};

// Keyboard navigation helper for drag and drop
export const useKeyboardDragDrop = (
  items: any[],
  onMove: (fromIndex: number, toIndex: number) => void
) => {
  const [dragModeIndex, setDragModeIndex] = useState<number | null>(null);

  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    const isDragMode = dragModeIndex === index;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (isDragMode) {
        setDragModeIndex(null);
        announceToScreenReader('Drag mode disabled');
      } else {
        setDragModeIndex(index);
        announceToScreenReader('Drag mode enabled. Use arrow keys to move, Escape to cancel.');
      }
      return;
    }

    if (isDragMode) {
      switch (event.key) {
        case 'ArrowUp':
          event.preventDefault();
          if (index > 0) {
            onMove(index, index - 1);
            announceToScreenReader(`Moved item up to position ${index}`);
          }
          break;
        case 'ArrowDown':
          event.preventDefault();
          if (index < items.length - 1) {
            onMove(index, index + 1);
            announceToScreenReader(`Moved item down to position ${index + 2}`);
          }
          break;
        case 'Escape':
          event.preventDefault();
          setDragModeIndex(null);
          announceToScreenReader('Drag mode cancelled');
          break;
      }
    }
  };

  return { dragModeIndex, handleKeyDown };
};

// Form validation accessibility helper
export const useAccessibleFormValidation = () => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const validateField = (fieldName: string, value: any, validator: (value: any) => string | null) => {
    const error = validator(value);
    setErrors(prev => ({
      ...prev,
      [fieldName]: error || ''
    }));
    return !error;
  };

  const touchField = (fieldName: string) => {
    setTouched(prev => ({
      ...prev,
      [fieldName]: true
    }));
  };

  const getFieldProps = (fieldName: string) => ({
    'aria-invalid': errors[fieldName] && touched[fieldName] ? 'true' : 'false',
    'aria-describedby': errors[fieldName] && touched[fieldName] ? `${fieldName}-error` : undefined,
  });

  const getErrorProps = (fieldName: string) => ({
    id: `${fieldName}-error`,
    role: 'alert',
    className: 'text-destructive text-sm mt-1'
  });

  return {
    errors,
    touched,
    validateField,
    touchField,
    getFieldProps,
    getErrorProps,
    hasErrors: Object.values(errors).some(error => error)
  };
};

// Skip link component
export const SkipLink = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a
    href={href}
    className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg"
  >
    {children}
  </a>
);

// Accessible button props helper
export const getAccessibleButtonProps = (
  label?: string,
  description?: string,
  pressed?: boolean
) => ({
  'aria-label': label,
  'aria-describedby': description ? `${label}-desc` : undefined,
  'aria-pressed': pressed !== undefined ? pressed : undefined,
});

// Accessible icon props (for decorative icons)
export const getAccessibleIconProps = () => ({
  'aria-hidden': 'true' as const,
  focusable: 'false' as const,
});

// Heading level manager for proper heading hierarchy
export const useHeadingLevel = (baseLevel: number = 1) => {
  const [currentLevel, setCurrentLevel] = useState(baseLevel);

  const getHeadingLevel = (increment: number = 0) => {
    const level = Math.min(6, Math.max(1, currentLevel + increment));
    return `h${level}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  };

  const increaseLevel = () => setCurrentLevel(prev => Math.min(6, prev + 1));
  const decreaseLevel = () => setCurrentLevel(prev => Math.max(1, prev - 1));

  return { getHeadingLevel, increaseLevel, decreaseLevel, currentLevel };
};

// Accessible table helpers
export const getTableProps = (caption?: string) => ({
  role: 'table',
  'aria-label': caption,
});

export const getTableHeaderProps = (sortable?: boolean, sortDirection?: 'asc' | 'desc') => ({
  role: 'columnheader',
  'aria-sort': sortable ? (sortDirection || 'none') : undefined,
  tabIndex: sortable ? 0 : undefined,
});

// Color contrast validation
export const validateColorContrast = (
  foreground: string,
  background: string,
  level: 'AA' | 'AAA' = 'AA',
  size: 'normal' | 'large' = 'normal'
): { passes: boolean; ratio: number; required: number } => {
  // This would integrate with the existing accessibility.ts utilities
  const required = level === 'AAA' 
    ? (size === 'large' ? 4.5 : 7) 
    : (size === 'large' ? 3 : 4.5);
  
  // Placeholder - would use actual contrast calculation
  const ratio = 4.5; // This should use the actual contrast calculation from accessibility.ts
  
  return {
    passes: ratio >= required,
    ratio,
    required
  };
};

// Accessible loading state
export const useAccessibleLoading = (isLoading: boolean, loadingMessage: string = 'Loading...') => {
  useEffect(() => {
    if (isLoading) {
      announceToScreenReader(loadingMessage);
    }
  }, [isLoading, loadingMessage]);

  const LoadingAnnouncement = () => (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {isLoading ? loadingMessage : ''}
    </div>
  );

  return { LoadingAnnouncement };
};

// Accessible error boundary
export const AccessibleErrorBoundary = ({ 
  error, 
  resetError, 
  children 
}: { 
  error: Error | null; 
  resetError: () => void; 
  children: React.ReactNode; 
}) => {
  if (error) {
    return (
      <div role="alert" className="p-4 border-theme-strong rounded-md">
        <h2 className="text-lg font-semibold text-destructive mb-2">
          Something went wrong
        </h2>
        <p className="text-sm text-muted-foreground mb-4">
          {error.message}
        </p>
        <button
          onClick={resetError}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
        >
          Try again
        </button>
      </div>
    );
  }

  return <>{children}</>;
};

// Export all utilities
export default {
  announceToScreenReader,
  trapFocus,
  useFocusTrap,
  useLiveRegion,
  useKeyboardDragDrop,
  useAccessibleFormValidation,
  SkipLink,
  getAccessibleButtonProps,
  getAccessibleIconProps,
  useHeadingLevel,
  getTableProps,
  getTableHeaderProps,
  validateColorContrast,
  useAccessibleLoading,
  AccessibleErrorBoundary
};
