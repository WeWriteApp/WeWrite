"use client";

import React from 'react';
import { CheckCircle, Circle } from 'lucide-react';
import { StatusIcon } from '../ui/status-icon';
import { CheckoutStep } from './SubscriptionCheckout';

interface CheckoutProgressIndicatorProps {
  steps: CheckoutStep[];
}

/**
 * CheckoutProgressIndicator - Visual progress indicator for checkout flow
 * 
 * Features:
 * - Clear visual indication of current step
 * - Completed step indicators
 * - Responsive design for mobile and desktop
 * - Accessible with proper ARIA labels
 */
export function CheckoutProgressIndicator({ steps }: CheckoutProgressIndicatorProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center flex-1">
            {/* Step Circle */}
            <div className="flex items-center">
              <div
                className={`
                  flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors
                  ${step.completed 
                    ? 'bg-green-500 border-green-500 text-white' 
                    : step.current 
                      ? 'bg-primary border-primary text-primary-foreground' 
                      : 'bg-background border-muted-foreground text-muted-foreground'
                  }
                `}
                aria-label={`Step ${index + 1}: ${step.title}`}
              >
                {step.completed ? (
                  <StatusIcon status="success" size="md" position="static" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </div>
              
              {/* Step Label - Hidden on mobile */}
              <div className="ml-3 hidden sm:block">
                <p className={`text-sm font-medium ${
                  step.current ? 'text-foreground' : 'text-muted-foreground'
                }`}>
                  {step.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
            
            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="flex-1 mx-4">
                <div
                  className={`h-0.5 transition-colors ${
                    step.completed ? 'bg-green-500' : 'bg-muted'
                  }`}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      
      {/* Mobile Step Labels */}
      <div className="mt-4 sm:hidden">
        {steps.map((step) => (
          step.current && (
            <div key={step.id} className="text-center">
              <p className="text-sm font-medium text-foreground">{step.title}</p>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </div>
          )
        ))}
      </div>
    </div>
  );
}
