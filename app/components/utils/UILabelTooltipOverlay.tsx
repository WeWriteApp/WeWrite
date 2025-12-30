'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';

/**
 * UILabelTooltipOverlay
 *
 * When enabled via admin testing tools, this overlay shows component/element
 * labels on hover. Useful for referencing UI elements when prompting or debugging.
 *
 * It detects elements with data-ui-label attributes and shows their labels in a tooltip.
 */
export default function UILabelTooltipOverlay() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Check localStorage on mount and listen for changes
  useEffect(() => {
    const checkEnabled = () => {
      if (typeof window !== 'undefined') {
        setIsEnabled(localStorage.getItem('wewrite_admin_ui_label_tooltips') === 'true');
      }
    };

    checkEnabled();

    // Listen for admin toggle changes
    const handleChange = () => checkEnabled();
    window.addEventListener('adminUiLabelTooltipsChange', handleChange);
    window.addEventListener('storage', handleChange);

    return () => {
      window.removeEventListener('adminUiLabelTooltipsChange', handleChange);
      window.removeEventListener('storage', handleChange);
    };
  }, []);

  // Find the closest element with a ui label
  const findLabeledElement = useCallback((element: HTMLElement | null): { element: HTMLElement; label: string } | null => {
    let current = element;
    while (current) {
      // Check for data-ui-label attribute
      const label = current.getAttribute('data-ui-label');
      if (label) {
        return { element: current, label };
      }

      // Check for common identifiable patterns
      // Component name from className patterns like "wewrite-card", "wewrite-button"
      const className = current.className;
      if (typeof className === 'string') {
        // Check for wewrite- prefixed classes
        const wewriteMatch = className.match(/wewrite-(\w+)/);
        if (wewriteMatch) {
          return { element: current, label: `wewrite-${wewriteMatch[1]}` };
        }
      }

      // Check for id
      if (current.id && !current.id.startsWith('radix-') && !current.id.startsWith(':r')) {
        return { element: current, label: `#${current.id}` };
      }

      // Check for role
      const role = current.getAttribute('role');
      if (role && ['button', 'dialog', 'menu', 'menuitem', 'tab', 'tabpanel', 'listbox', 'option'].includes(role)) {
        const ariaLabel = current.getAttribute('aria-label');
        if (ariaLabel) {
          return { element: current, label: `${role}: ${ariaLabel}` };
        }
      }

      current = current.parentElement;
    }
    return null;
  }, []);

  // Handle mouse movement
  useEffect(() => {
    if (!isEnabled) {
      setTooltip(null);
      return;
    }

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const result = findLabeledElement(target);

      if (result) {
        // Position tooltip near cursor
        const x = e.clientX + 10;
        const y = e.clientY + 10;

        setTooltip({ x, y, label: result.label });

        // Add highlight to element
        result.element.style.outline = '2px solid rgba(59, 130, 246, 0.5)';
        result.element.style.outlineOffset = '2px';
      } else {
        setTooltip(null);
      }
    };

    const handleMouseOut = (e: MouseEvent) => {
      // Remove highlight from previous element
      const target = e.target as HTMLElement;
      const result = findLabeledElement(target);
      if (result) {
        result.element.style.outline = '';
        result.element.style.outlineOffset = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseout', handleMouseOut);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseout', handleMouseOut);

      // Clean up any remaining outlines
      document.querySelectorAll('[style*="outline"]').forEach((el) => {
        (el as HTMLElement).style.outline = '';
        (el as HTMLElement).style.outlineOffset = '';
      });
    };
  }, [isEnabled, findLabeledElement]);

  // Adjust tooltip position if it would overflow viewport
  useEffect(() => {
    if (tooltip && tooltipRef.current) {
      const rect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let newX = tooltip.x;
      let newY = tooltip.y;

      if (rect.right > viewportWidth) {
        newX = tooltip.x - rect.width - 20;
      }
      if (rect.bottom > viewportHeight) {
        newY = tooltip.y - rect.height - 20;
      }

      if (newX !== tooltip.x || newY !== tooltip.y) {
        setTooltip({ ...tooltip, x: newX, y: newY });
      }
    }
  }, [tooltip]);

  if (!isEnabled || !tooltip) {
    return null;
  }

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[9999] pointer-events-none px-2 py-1 rounded text-xs font-mono bg-blue-600 text-white shadow-lg"
      style={{
        left: tooltip.x,
        top: tooltip.y,
      }}
    >
      {tooltip.label}
    </div>
  );
}
