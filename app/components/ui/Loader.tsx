"use client";

import { GridLoader } from "react-spinners";
import { cn } from "@/lib/utils";

interface LoaderProps {
  /** Size of the loader in pixels. GridLoader will use size/3 for individual dots */
  size?: number;
  /** Color of the loader. Defaults to currentColor */
  color?: string;
  /** Additional CSS classes */
  className?: string;
  /** Speed multiplier for the animation */
  speedMultiplier?: number;
}

/**
 * Loader Component
 *
 * A centralized loading spinner using GridLoader.
 * All loading indicators across the app should use this component
 * so we can easily change the loader style in one place.
 *
 * The GridLoader displays a grid of dots that animate.
 * It does NOT spin - it has a pulsing/scaling animation instead.
 */
export function Loader({
  size = 24,
  color,
  className,
  speedMultiplier = 1,
}: LoaderProps) {
  return (
    <span className={cn("inline-flex items-center justify-center", className)}>
      <GridLoader
        size={size / 3} // GridLoader uses smaller size units for individual dots
        color={color || "currentColor"}
        loading={true}
        speedMultiplier={speedMultiplier}
      />
    </span>
  );
}

export default Loader;
