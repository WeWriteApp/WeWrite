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
          className="mobile-slider-input w-full"
          style={{
            background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${percentage}%, hsl(var(--muted)) ${percentage}%, hsl(var(--muted)) 100%)`
          }}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
        />
      </div>
      
      {description && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}
      
      <style jsx>{`
        .mobile-slider-input {
          -webkit-appearance: none;
          appearance: none;
          height: 32px;
          border-radius: 16px;
          outline: none;
          touch-action: manipulation;
          cursor: pointer;
          border: 1px solid hsl(var(--border));
          transition: all 0.2s ease;
        }
        
        .mobile-slider-input:focus {
          border-color: hsl(var(--primary));
          box-shadow: 0 0 0 2px hsl(var(--primary) / 0.2);
        }
        
        .mobile-slider-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          height: 28px;
          width: 28px;
          border-radius: 14px;
          background: hsl(var(--primary));
          cursor: pointer;
          border: 2px solid hsl(var(--background));
          box-shadow: 0 2px 4px rgba(0,0,0,0.15);
          transition: all 0.2s ease;
        }
        
        .mobile-slider-input::-moz-range-thumb {
          height: 28px;
          width: 28px;
          border-radius: 14px;
          background: hsl(var(--primary));
          cursor: pointer;
          border: 2px solid hsl(var(--background));
          box-shadow: 0 2px 4px rgba(0,0,0,0.15);
          transition: all 0.2s ease;
        }
        
        .mobile-slider-input:active::-webkit-slider-thumb {
          transform: scale(1.1);
          box-shadow: 0 3px 6px rgba(0,0,0,0.2);
        }

        .mobile-slider-input:active::-moz-range-thumb {
          transform: scale(1.1);
          box-shadow: 0 3px 6px rgba(0,0,0,0.2);
        }
        
        .mobile-slider-input::-webkit-slider-track {
          height: 32px;
          border-radius: 16px;
          background: transparent;
        }

        .mobile-slider-input::-moz-range-track {
          height: 32px;
          border-radius: 16px;
          background: transparent;
          border: none;
        }
        
        /* Remove default Firefox styling */
        .mobile-slider-input::-moz-range-progress {
          background: transparent;
        }
        
        /* Ensure proper touch targets on mobile */
        @media (max-width: 768px) {
          .mobile-slider-input {
            height: 40px;
            border-radius: 20px;
          }

          .mobile-slider-input::-webkit-slider-thumb {
            height: 36px;
            width: 36px;
            border-radius: 18px;
          }

          .mobile-slider-input::-moz-range-thumb {
            height: 36px;
            width: 36px;
            border-radius: 18px;
          }

          .mobile-slider-input::-webkit-slider-track {
            height: 40px;
            border-radius: 20px;
          }

          .mobile-slider-input::-moz-range-track {
            height: 40px;
            border-radius: 20px;
          }
        }
      `}</style>
    </div>
  );
}
