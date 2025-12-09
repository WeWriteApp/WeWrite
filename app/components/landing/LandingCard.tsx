"use client";

import React, { useState, CSSProperties, forwardRef } from 'react';
import { useLandingColors } from './LandingColorContext';

/**
 * LandingCard - A card component for the landing page that uses the isolated
 * LandingColorContext instead of global CSS variables.
 *
 * This component uses inline styles to ensure colors cannot be overwritten
 * by AccentColorContext or NeutralColorContext.
 */

interface LandingCardProps {
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  rounded?: 'none' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

const paddingMap = {
  none: '0',
  sm: '0.5rem',
  md: '1rem',
  lg: '1.5rem',
  xl: '2rem',
};

const roundedMap = {
  none: '0',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  '2xl': '1.5rem',
};

export const LandingCard = forwardRef<HTMLDivElement, LandingCardProps>(
  function LandingCard(
    {
      children,
      className = '',
      style = {},
      onClick,
      hoverable = true,
      padding = 'md',
      rounded = 'xl',
    },
    ref
  ) {
    const colors = useLandingColors();
    const [isHovered, setIsHovered] = useState(false);

    // Compute current colors based on hover state
    const currentBg = isHovered && hoverable ? colors.cardBgHover : colors.cardBg;
    const currentBorder = isHovered && hoverable ? colors.cardBorderHover : colors.cardBorder;

    // Base styles that cannot be overwritten
    const cardStyle: CSSProperties = {
      backgroundColor: currentBg,
      borderColor: currentBorder,
      borderWidth: '1px',
      borderStyle: 'solid',
      borderRadius: roundedMap[rounded],
      padding: paddingMap[padding],
      color: colors.cardText,
      transition: 'all 0.2s ease-in-out',
      backdropFilter: 'blur(10px) saturate(180%)',
      WebkitBackdropFilter: 'blur(10px) saturate(180%)',
      boxShadow: colors.isDark
        ? '0 1px 3px 0 rgb(0 0 0 / 0.3), 0 1px 2px -1px rgb(0 0 0 / 0.3)'
        : '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
      ...style, // Allow overrides for specific properties
    };

    // Enhanced shadow on hover
    if (isHovered && hoverable) {
      cardStyle.boxShadow = colors.isDark
        ? '0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)'
        : '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)';
      cardStyle.transform = 'translateY(-1px)';
    }

    return (
      <div
        ref={ref}
        className={className}
        style={cardStyle}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {children}
      </div>
    );
  }
);

/**
 * LandingCardText - Text styled for landing cards
 */
interface LandingCardTextProps {
  children: React.ReactNode;
  muted?: boolean;
  className?: string;
  style?: CSSProperties;
  as?: 'p' | 'span' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
}

export function LandingCardText({
  children,
  muted = false,
  className = '',
  style = {},
  as: Component = 'span',
}: LandingCardTextProps) {
  const colors = useLandingColors();

  const textStyle: CSSProperties = {
    color: muted ? colors.cardTextMuted : colors.cardText,
    ...style,
  };

  return (
    <Component className={className} style={textStyle}>
      {children}
    </Component>
  );
}

/**
 * LandingBlob - A gradient blob for the landing page background
 */
interface LandingBlobProps {
  className?: string;
  style?: CSSProperties;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  position?: {
    top?: string;
    bottom?: string;
    left?: string;
    right?: string;
  };
  opacity?: number;
}

const blobSizeMap = {
  sm: { width: '35vw', height: '35vw', maxWidth: '450px', maxHeight: '450px' },
  md: { width: '40vw', height: '40vw', maxWidth: '500px', maxHeight: '500px' },
  lg: { width: '50vw', height: '50vw', maxWidth: '700px', maxHeight: '700px' },
  xl: { width: '60vw', height: '60vw', maxWidth: '800px', maxHeight: '800px' },
};

export function LandingBlob({
  className = '',
  style = {},
  size = 'lg',
  position = {},
  opacity = 0.25,
}: LandingBlobProps) {
  const colors = useLandingColors();
  const sizeStyles = blobSizeMap[size];

  const blobStyle: CSSProperties = {
    position: 'absolute',
    borderRadius: '50%',
    filter: colors.isDark ? 'blur(100px)' : 'blur(80px)',
    opacity: colors.isDark ? opacity * 0.8 : opacity,
    willChange: 'transform',
    background: colors.blobColor,
    transition: 'background 0.3s ease-out',
    ...sizeStyles,
    ...position,
    ...style,
  };

  return <div className={className} style={blobStyle} aria-hidden="true" />;
}

export default LandingCard;
