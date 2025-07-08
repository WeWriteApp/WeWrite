'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Checkbox } from '../ui/checkbox';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Label } from '../ui/label';
import {
  Settings,
  X,
  GripHorizontal,
  Eye,
  EyeOff,
  RotateCcw,
  RefreshCw
} from 'lucide-react';
import { useAdminStateSimulator } from '../../hooks/useAdminStateSimulator';
import { STATE_CATEGORIES } from '../../config/adminStateSimulatorConfig';
import { useToast } from '../ui/use-toast';

interface AdminStateSimulatorProps {
  className?: string;
}

export default function AdminStateSimulator({ className }: AdminStateSimulatorProps) {
  const adminStateHook = useAdminStateSimulator();
  const { toast } = useToast();
  const {
    isVisible,
    isExpanded,
    position,
    authState,
    subscriptionState,
    spendingState,
    tokenEarningsState,
    toggleVisibility,
    toggleExpanded,
    updatePosition,
    setAuthState,
    setSubscriptionState,
    setSpendingState,
    setTokenEarningsState,
    hideForSession
  } = adminStateHook;

  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartTime, setDragStartTime] = useState(0);
  const simulatorRef = useRef<HTMLDivElement>(null);

  // Smart expansion that adjusts position to keep expanded window in viewport
  const handleSmartExpansion = () => {
    if (!simulatorRef.current) {
      toggleExpanded();
      return;
    }

    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    // Dimensions when expanded (approximate)
    const expandedWidth = 320; // w-80 = 20rem = 320px
    const expandedHeight = 600; // Approximate height when expanded
    const collapsedSize = 48; // h-12 w-12 = 48px

    const currentPos = position;

    // Calculate optimal position to keep expanded window in viewport
    let newX = currentPos.x;
    let newY = currentPos.y;

    // Adjust X position
    if (currentPos.x + expandedWidth > viewport.width) {
      // If expanding would go off right edge, move left
      newX = Math.max(10, viewport.width - expandedWidth - 10);
    } else if (currentPos.x < 10) {
      // If too close to left edge, move right
      newX = 10;
    }

    // Adjust Y position
    if (currentPos.y + expandedHeight > viewport.height) {
      // If expanding would go off bottom edge, move up
      newY = Math.max(10, viewport.height - expandedHeight - 10);
    } else if (currentPos.y < 10) {
      // If too close to top edge, move down
      newY = 10;
    }

    // Update position if needed before expanding
    if (newX !== currentPos.x || newY !== currentPos.y) {
      updatePosition({ x: newX, y: newY });
    }

    // Expand the simulator
    toggleExpanded();
  };

  // Handle dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!simulatorRef.current) return;

    // Prevent default to avoid any unwanted behaviors
    e.preventDefault();
    e.stopPropagation();

    const rect = simulatorRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setDragStartTime(Date.now());
    setIsDragging(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !simulatorRef.current) return;

    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    const elementRect = simulatorRef.current.getBoundingClientRect();

    let newX = e.clientX - dragOffset.x;
    let newY = e.clientY - dragOffset.y;

    // Constrain to viewport with padding to ensure it's always reachable
    const padding = 10;
    newX = Math.max(padding, Math.min(newX, viewport.width - elementRect.width - padding));
    newY = Math.max(padding, Math.min(newY, viewport.height - elementRect.height - padding));

    updatePosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    const dragDuration = Date.now() - dragStartTime;
    setIsDragging(false);

    // If it was a quick click (less than 200ms) and not much movement, treat as click
    if (dragDuration < 200) {
      // Only toggle expansion for collapsed state
      if (!isExpanded) {
        handleSmartExpansion();
      }
    }
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, dragOffset]);

  // Handle touch events for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (!simulatorRef.current) return;

    // Prevent default to avoid any unwanted behaviors
    e.preventDefault();
    e.stopPropagation();

    const touch = e.touches[0];
    const rect = simulatorRef.current.getBoundingClientRect();
    setDragOffset({
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    });
    setDragStartTime(Date.now());
    setIsDragging(true);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging || !simulatorRef.current) return;
    e.preventDefault();

    const touch = e.touches[0];
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    const elementRect = simulatorRef.current.getBoundingClientRect();

    let newX = touch.clientX - dragOffset.x;
    let newY = touch.clientY - dragOffset.y;

    // Constrain to viewport with padding to ensure it's always reachable
    const padding = 10;
    newX = Math.max(padding, Math.min(newX, viewport.width - elementRect.width - padding));
    newY = Math.max(padding, Math.min(newY, viewport.height - elementRect.height - padding));

    updatePosition({ x: newX, y: newY });
  };

  const handleTouchEnd = () => {
    const dragDuration = Date.now() - dragStartTime;
    setIsDragging(false);

    // If it was a quick tap (less than 200ms) and not much movement, treat as tap
    if (dragDuration < 200) {
      // Only toggle expansion for collapsed state
      if (!isExpanded) {
        handleSmartExpansion();
      }
    }
  };



  if (!isVisible) return null;

  return (
    <div
      ref={simulatorRef}
      className={`fixed z-[9999] ${className}`}
      style={{
        left: position.x,
        top: position.y,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
    >
      {!isExpanded ? (
        // Collapsed state - floating button
        <Button
          variant="secondary"
          size="icon"
          className="h-12 w-12 rounded-full shadow-xl bg-orange-500 hover:bg-orange-600 text-white border-2 border-orange-300"
          onMouseDown={handleMouseDown}
          onTouchStart={handleTouchStart}
        >
          <Settings className="h-6 w-6" />
        </Button>
      ) : (
        // Expanded state - draggable window
        <Card className="w-80 shadow-2xl border-2 border-orange-200 dark:border-orange-700 bg-white dark:bg-gray-800">
          <CardHeader
            className="pb-2 cursor-grab active:cursor-grabbing bg-orange-50 dark:bg-orange-900/20"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripHorizontal className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                <CardTitle className="text-sm font-medium text-orange-800 dark:text-orange-200">
                  Admin State Simulator
                </CardTitle>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-200"
                  onClick={hideForSession}
                >
                  <EyeOff className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-200"
                  onClick={toggleExpanded}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-sm bg-white dark:bg-gray-800">
            {/* Dynamic State Categories */}
            {STATE_CATEGORIES.map((category) => {
              const IconComponent = category.icon;
              const currentValue = (adminStateHook as any)[category.id];
              const setter = (adminStateHook as any)[`set${category.id.charAt(0).toUpperCase() + category.id.slice(1)}`];

              return (
                <div key={category.id} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <IconComponent className="h-4 w-4 text-blue-600" />
                    <Label className="font-medium">{category.name}</Label>
                  </div>

                  {category.type === 'radio' && (
                    <RadioGroup value={currentValue} onValueChange={setter}>
                      {category.options?.map((option) => (
                        <div key={option.id} className="flex items-center space-x-2">
                          <RadioGroupItem value={option.value} id={`${category.id}-${option.id}`} />
                          <Label htmlFor={`${category.id}-${option.id}`} className="text-xs">
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  )}

                  {category.type === 'multi-checkbox' && (
                    <div className="space-y-1">
                      {category.options?.map((option) => (
                        <div key={option.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`${category.id}-${option.id}`}
                            checked={currentValue?.[option.id] || false}
                            onCheckedChange={(checked) =>
                              setter({ [option.id]: !!checked })
                            }
                          />
                          <Label htmlFor={`${category.id}-${option.id}`} className="text-xs">
                            {option.label}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}

                  {category.type === 'toggle' && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={category.id}
                        checked={currentValue || false}
                        onCheckedChange={(checked) => setter(!!checked)}
                      />
                      <Label htmlFor={category.id} className="text-xs">
                        {category.description}
                      </Label>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Current State Display */}
            <div className="pt-2 border-t">
              <div className="flex flex-wrap gap-1">
                {STATE_CATEGORIES.map((category) => {
                  const currentValue = (adminStateHook as any)[category.id];
                  const isActive = getStateDisplayValue(category, currentValue);

                  if (isActive) {
                    return (
                      <Badge key={category.id} variant="outline" className="text-xs">
                        {isActive}
                      </Badge>
                    );
                  }
                  return null;
                })}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 border-t border-orange-100 dark:border-orange-800 space-y-2">
              <Button
                variant="default"
                size="sm"
                className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                onClick={() => window.location.reload()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Apply Changes (Refresh Page)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                onClick={async () => {
                  try {
                    const detectedState = await adminStateHook.resetToActualState();
                    const authText = detectedState.authState === 'logged-in' ? 'logged in' : 'logged out';
                    const subText = detectedState.subscriptionState === 'active' ? 'active subscription' :
                                   detectedState.subscriptionState === 'cancelling' ? 'cancelling subscription' :
                                   detectedState.subscriptionState === 'payment-failed' ? 'payment failed' : 'no subscription';

                    toast({
                      title: "Reset to actual state",
                      description: `Detected: ${authText}, ${subText}`,
                      variant: "success"
                    });
                  } catch (error) {
                    console.error('Error resetting to actual state:', error);
                    toast({
                      title: "Reset failed",
                      description: "Failed to detect actual state. Please try again.",
                      variant: "destructive"
                    });
                  }
                }}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to Actual State
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function getStateDisplayValue(category: any, currentValue: any): string | null {
  switch (category.type) {
    case 'radio':
      const option = category.options?.find((opt: any) => opt.value === currentValue);
      return option?.label || null;

    case 'multi-checkbox':
      if (typeof currentValue === 'object' && currentValue) {
        const activeOptions = Object.entries(currentValue)
          .filter(([key, value]) => value && key !== 'none')
          .map(([key]) => {
            const option = category.options?.find((opt: any) => opt.id === key);
            return option?.label || key;
          });

        if (activeOptions.length > 0) {
          return activeOptions.length === 1 ? activeOptions[0] : `${activeOptions.length} active`;
        }
      }
      return null;

    case 'toggle':
    case 'checkbox':
      return currentValue ? category.name : null;

    default:
      return null;
  }
}
