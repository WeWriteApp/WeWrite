"use client";

import React, { useState } from "react";
import NextImage, { ImageProps as NextImageProps } from "next/image";
import { cn } from "../../lib/utils";
import { ImagePlaceholder } from "./placeholder";

interface ImageProps extends Omit<NextImageProps, "onError"> {
  fallbackClassName?: string;
}

/**
 * Enhanced Image component with built-in fallback
 * 
 * This component extends Next.js Image with a fallback placeholder
 * that shows when the image fails to load or during loading.
 */
export function Image({
  alt,
  src,
  className,
  fallbackClassName,
  ...props
}: ImageProps) {
  const [error, setError] = useState(false);
  
  // If the image failed to load, show the placeholder
  if (error) {
    return (
      <ImagePlaceholder
        className={cn("overflow-hidden", fallbackClassName || className)}
        width={props.width}
        height={props.height}
      />
    );
  }

  return (
    <NextImage
      className={className}
      alt={alt}
      src={src}
      onError={() => setError(true)}
      {...props}
    />
  );
}
