"use client";

import React from 'react';

interface MobileSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  formatValue?: (value: number) => string;
  description?: string;
}

/**
 * MobileSlider Component
 * 
 * A mobile-friendly slider with large touch targets and proper touch handling
 */
export default function MobileSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  formatValue = (val) => val.toString(),
  description
}: MobileSliderProps) {
  
  const percentage = ((value - min) / (max - min)) * 100;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value);
    onChange(newValue);
  };

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    const newValue = parseFloat((e.target as HTMLInputElement).value);
    onChange(newValue);
  };

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium">
        {label}: {formatValue(value)}
      </label>

      <div className="relative">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={handleChange}
          onInput={handleInput}
          className="mobile-slider-input w-full wewrite-input"
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${percentage}%, hsl(var(--muted)) ${percentage}%, hsl(var(--muted)) 100%)`,
            touchAction: 'manipulation',
            userSelect: 'none',
            pointerEvents: 'auto'
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
        />
      </div>

      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      <style jsx>{`
        .mobile-slider-input {
          -webkit-appearance: none !important;
          appearance: none !important;
          height: 8px;
          border-radius: 4px;
          outline: none;
          touch-action: manipulation !important;
          cursor: pointer;
          border: none;
          transition: all 0.2s ease;
          user-select: none !important;
          pointer-events: auto !important;
          position: relative;
          z-index: 10;
        }

        .mobile-slider-input:focus {
          border-color: hsl(var(--primary)) !important;
          box-shadow: 0 0 0 2px hsl(var(--primary) / 0.2) !important;
        }

        .mobile-slider-input::-webkit-slider-thumb {
          -webkit-appearance: none !important;
          appearance: none !important;
          height: 20px;
          width: 20px;
          border-radius: 10px;
          background: hsl(var(--primary)) !important;
          cursor: pointer !important;
          border: none;
          box-shadow: 0 2px 4px hsl(var(--foreground) / 0.15);
          transition: all 0.2s ease;
          touch-action: manipulation !important;
          pointer-events: auto !important;
        }
        
        .mobile-slider-input::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 10px;
          background: hsl(var(--primary)) !important;
          cursor: pointer !important;
          border: none;
          box-shadow: 0 2px 4px hsl(var(--foreground) / 0.15);
          transition: all 0.2s ease;
          touch-action: manipulation !important;
          pointer-events: auto !important;
        }
        
        .mobile-slider-input:active::-webkit-slider-thumb {
          transform: scale(1.1);
          box-shadow: 0 3px 6px hsl(var(--foreground) / 0.2);
        }

        .mobile-slider-input:active::-moz-range-thumb {
          transform: scale(1.1);
          box-shadow: 0 3px 6px hsl(var(--foreground) / 0.2);
        }
        
        .mobile-slider-input::-webkit-slider-track {
          height: 8px;
          border-radius: 4px;
          background: transparent;
          touch-action: manipulation !important;
        }

        .mobile-slider-input::-moz-range-track {
          height: 8px;
          border-radius: 4px;
          background: transparent;
          touch-action: manipulation !important;
          border: none;
        }
        
        /* Remove default Firefox styling */
        .mobile-slider-input::-moz-range-progress {
          background: transparent;
        }
        
        /* Ensure proper touch targets on mobile */
        @media (max-width: 768px) {
          .mobile-slider-input {
            height: 12px;
            border-radius: 6px;
          }

          .mobile-slider-input::-webkit-slider-thumb {
            height: 24px;
            width: 24px;
            border-radius: 12px;
          }

          .mobile-slider-input::-moz-range-thumb {
            height: 24px;
            width: 24px;
            border-radius: 12px;
          }

          .mobile-slider-input::-webkit-slider-track {
            height: 12px;
            border-radius: 6px;
          }

          .mobile-slider-input::-moz-range-track {
            height: 12px;
            border-radius: 6px;
          }
        }
      `}</style>
    </div>
  );
}
