"use client";

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";

/**
 * FixedPortal
 *
 * Renders children into a DOM node attached to document.body to guarantee
 * viewport-relative positioning for position: fixed elements, regardless of
 * transforms/contain/isolation on React ancestors.
 */
export interface FixedPortalProps {
  children: React.ReactNode;
  /**
   * Optional container ID. Multiple portals with the same ID will reuse a
   * single node.
   */
  containerId?: string;
  /** Additional className applied to the portal container element */
  className?: string;
  /** Inline styles applied to the portal container element */
  style?: React.CSSProperties;
}

export default function FixedPortal({
  children,
  containerId = "wewrite-fixed-layer-root",
  className,
  style,
}: FixedPortalProps) {
  const [mounted, setMounted] = useState(false);
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMounted(true);
    // Ensure a single shared container exists
    let el = document.getElementById(containerId) as HTMLElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = containerId;
      // Ensure the container itself does not create stacking/scroll contexts
      el.style.position = "static"; // children control their own positioning
      el.style.pointerEvents = "none"; // children can re-enable via pointer-events:auto
      // No transforms, filters, or containment on this node
      document.body.appendChild(el);
    }

    setContainer(el);

    return () => {
      // Do not remove the container to avoid tearing if other portals use it
    };
  }, [containerId]);

  const mergedStyle = useMemo<React.CSSProperties | undefined>(() => {
    if (!style && !className) return undefined;
    return style;
  }, [style, className]);

  if (!mounted || !container) return null;

  return createPortal(
    <div className={className} style={mergedStyle} style-data-fixed-portal>
      {children}
    </div>,
    container
  );
}

