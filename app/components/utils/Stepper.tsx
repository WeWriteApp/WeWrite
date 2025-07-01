"use client";

import React, { useState } from 'react';
import { ChevronDown, Plus, Minus } from 'lucide-react';
import { useTheme } from 'next-themes';

interface StepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  formatValue?: (value: number) => string;
}

const defaultIncrements = [0.01, 0.1, 1.00, 10.00];

export default function Stepper({
  value,
  onChange,
  min = 0,
  max = Infinity,
  step = 1,
  formatValue = (v) => v.toFixed(2)
}: StepperProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [increment, setIncrement] = useState(1.00);
  const [customIncrement, setCustomIncrement] = useState('');
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const handleIncrement = (amount: number) => {
    const newValue = Math.min(max, value + (amount * increment));
    onChange(Math.max(min, newValue));
  };

  const handleIncrementChange = (value: number) => {
    setIncrement(value);
    setIsOpen(false);
  };

  const handleCustomIncrementSubmit = () => {
    const value = parseFloat(customIncrement);
    if (!isNaN(value) && value > 0) {
      setIncrement(value);
      setCustomIncrement('');
      setIsOpen(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium">Test Stepper</h3>
      
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Current increment: ${increment.toFixed(2)}</span>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
        >
          Change
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {isOpen && (
        <div className="p-4 rounded-lg border bg-background shadow-lg space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {defaultIncrements.map((value) => (
              <button
                key={value}
                onClick={() => handleIncrementChange(value)}
                className={`px-3 py-2 rounded-md text-sm transition-colors
                  ${increment === value 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-secondary hover:bg-secondary/80'}`}
              >
                ${value.toFixed(2)}
              </button>
            ))}
          </div>
          
          <div className="flex gap-2">
            <input
              type="number"
              value={customIncrement}
              onChange={(e) => setCustomIncrement(e.target.value)}
              placeholder="Custom amount"
              step="0.01"
              min="0.01"
              className="flex-1 px-3 py-2 rounded-md bg-background border text-sm"
            />
            <button
              onClick={handleCustomIncrementSubmit}
              disabled={!customIncrement}
              className="px-3 py-2 rounded-md bg-primary text-primary-foreground disabled:opacity-50"
            >
              Set
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={() => handleIncrement(-1)}
          className="p-2 rounded-md bg-secondary hover:bg-secondary/80"
        >
          <Minus className="h-5 w-5" />
        </button>
        
        <span className="text-lg font-medium">
          ${formatValue(value)}
        </span>
        
        <button
          onClick={() => handleIncrement(1)}
          className="p-2 rounded-md bg-secondary hover:bg-secondary/80"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}