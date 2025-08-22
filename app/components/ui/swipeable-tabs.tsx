"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "./tabs";
import { cn } from "../../lib/utils";

export interface SwipeableTabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
  className?: string;
  tabsListClassName?: string;
  tabsContentClassName?: string;
  tabsContentWrapperClassName?: string;
  preventScrollOnSwipe?: boolean;
  swipeDistance?: number;
  animationDuration?: number;
}

export interface SwipeableTabsListProps {
  children?: React.ReactNode;
  className?: string;
}

export interface SwipeableTabsTriggerProps {
  value: string;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export interface SwipeableTabsContentProps {
  value: string;
  children?: React.ReactNode;
  className?: string;
}

const SwipeableTabs = ({
  defaultValue,
  value,
  onValueChange,
  children,
  className,
  tabsListClassName,
  tabsContentClassName,
  tabsContentWrapperClassName,
  preventScrollOnSwipe = false,
  swipeDistance = 100,
  animationDuration = 0.3}: SwipeableTabsProps) => {
  const [activeTab, setActiveTab] = useState(value || defaultValue || "");
  const [direction, setDirection] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [dragX, setDragX] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);

  // Extract all tab values from children to determine tab order
  const tabValues: string[] = [];
  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child) && child.type === SwipeableTabsList) {
      React.Children.forEach(child.props.children, (tabChild) => {
        if (
          React.isValidElement(tabChild) &&
          tabChild.type === SwipeableTabsTrigger &&
          typeof tabChild.props.value === "string"
        ) {
          tabValues.push(tabChild.props.value);
        }
      });
    }
  });

  // Update active tab when value prop changes
  useEffect(() => {
    if (value !== undefined && value !== activeTab) {
      // Determine direction based on tab order
      const oldIndex = tabValues.indexOf(activeTab);
      const newIndex = tabValues.indexOf(value);
      setDirection(newIndex > oldIndex ? 1 : -1);
      setActiveTab(value);
    }
  }, [value, activeTab, tabValues]);

  // Handle tab change
  const handleTabChange = (newValue: string) => {
    if (newValue !== activeTab) {
      // Determine direction based on tab order
      const oldIndex = tabValues.indexOf(activeTab);
      const newIndex = tabValues.indexOf(newValue);
      setDirection(newIndex > oldIndex ? 1 : -1);
      setActiveTab(newValue);
      onValueChange?.(newValue);
    }
  };

  // Touch event handlers for swipe detection
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setDragX(0);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStart) return;

    const currentX = e.targetTouches[0].clientX;
    setTouchEnd(currentX);

    // Calculate drag distance
    const dragDistance = currentX - touchStart;
    setDragX(dragDistance);

    // Prevent default scrolling if needed
    if (preventScrollOnSwipe && Math.abs(dragDistance) > 30) {
      e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) {
      setIsDragging(false);
      setDragX(0);
      return;
    }

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > swipeDistance / 2;
    const isRightSwipe = distance < -swipeDistance / 2;

    if (isLeftSwipe || isRightSwipe) {
      const currentIndex = tabValues.indexOf(activeTab);
      let newIndex;

      if (isLeftSwipe && currentIndex < tabValues.length - 1) {
        // Swipe left to go to next tab
        newIndex = currentIndex + 1;
        setDirection(1);
      } else if (isRightSwipe && currentIndex > 0) {
        // Swipe right to go to previous tab
        newIndex = currentIndex - 1;
        setDirection(-1);
      } else {
        // Reset if we can't swipe in this direction
        setDragX(0);
        setIsDragging(false);
        return;
      }

      const newTab = tabValues[newIndex];
      handleTabChange(newTab);
    }

    // Reset state
    setTouchStart(null);
    setTouchEnd(null);
    setIsDragging(false);
    setDragX(0);
  };

  // Use react-swipeable for better swipe detection
  const swipeHandlers = useSwipeable({
    onSwipeStart: (e) => {
      setTouchStart(e.initial.x);
      setDragX(0);
      setIsDragging(true);
    },
    onSwiping: (e) => {
      setDragX(e.deltaX);
      setTouchEnd(e.initial.x + e.deltaX);
    },
    onSwipedLeft: (e) => {
      const currentIndex = tabValues.indexOf(activeTab);
      if (currentIndex < tabValues.length - 1) {
        const nextTab = tabValues[currentIndex + 1];
        setDirection(1);
        handleTabChange(nextTab);
      }
      setIsDragging(false);
      setDragX(0);
    },
    onSwipedRight: (e) => {
      const currentIndex = tabValues.indexOf(activeTab);
      if (currentIndex > 0) {
        const prevTab = tabValues[currentIndex - 1];
        setDirection(-1);
        handleTabChange(prevTab);
      }
      setIsDragging(false);
      setDragX(0);
    },
    onSwiped: () => {
      setIsDragging(false);
      setDragX(0);
    },
    preventDefaultTouchmoveEvent: preventScrollOnSwipe,
    trackMouse: true,
    trackTouch: true,
    delta: 10, // Lower threshold for easier swiping
    swipeDuration: 500, // Longer duration for swipe detection
  });

  // Render the tabs with the appropriate children
  return (
    <Tabs
      defaultValue={defaultValue}
      value={activeTab}
      onValueChange={handleTabChange}
      className={cn("w-full", className)}
    >
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return null;

        // Handle SwipeableTabsList
        if (child.type === SwipeableTabsList) {
          return (
            <div
              className="relative border-b border-neutral-30 mb-4"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              <TabsList className={cn("flex w-max border-0 bg-transparent p-0 justify-start h-auto min-h-0", tabsListClassName)}>
                {React.Children.map(child.props.children, (tabChild) => {
                  if (!React.isValidElement(tabChild)) return null;

                  // If it's a div containing SwipeableTabsTriggers, process its children
                  if (tabChild.type === 'div' && tabChild.props.children) {
                    // Extract all SwipeableTabsTrigger children from the div
                    const triggers = [];
                    React.Children.forEach(tabChild.props.children, (nestedChild) => {
                      if (React.isValidElement(nestedChild) && nestedChild.type === SwipeableTabsTrigger) {
                        triggers.push(nestedChild);
                      }
                    });

                    // Return the TabsTriggers directly without the wrapping div
                    return triggers.map((trigger) => (
                      <TabsTrigger
                        key={trigger.props.value}
                        value={trigger.props.value}
                        disabled={trigger.props.disabled}
                        className={trigger.props.className}
                      >
                        {trigger.props.children}
                      </TabsTrigger>
                    ));
                  }

                  // Direct SwipeableTabsTrigger children
                  if (tabChild.type === SwipeableTabsTrigger) {
                    return (
                      <TabsTrigger
                        value={tabChild.props.value}
                        disabled={tabChild.props.disabled}
                        className={tabChild.props.className}
                      >
                        {tabChild.props.children}
                      </TabsTrigger>
                    );
                  }

                  return tabChild;
                })}
              </TabsList>
            </div>
          );
        }

        // Handle SwipeableTabsContent
        if (child.type === SwipeableTabsContent) {
          return (
            <TabsContent
              value={child.props.value}
              className={cn("mt-0", child.props.className, tabsContentClassName)}
            >
              <div className="relative">
                <AnimatedTabsContent
                  direction={direction}
                  activeTab={activeTab}
                  currentTab={child.props.value}
                  isDragging={isDragging}
                  dragX={dragX}
                  tabValues={tabValues}
                  animationDuration={animationDuration}
                >
                  <div
                    {...swipeHandlers}
                    className="swipe-area"
                    style={{
                      width: '100%',
                      position: 'relative',
                      touchAction: preventScrollOnSwipe ? 'none' : 'pan-y'}}
                  >
                    {child.props.children}
                  </div>
                </AnimatedTabsContent>
              </div>
            </TabsContent>
          );
        }

        return child;
      })}
    </Tabs>
  );
};

// Animated wrapper for tabs content with fade transitions
const AnimatedTabsContent = ({
  children,
  direction,
  activeTab,
  currentTab,
  isDragging = false,
  dragX = 0,
  tabValues = [],
  animationDuration = 0.3}: {
  children: React.ReactNode;
  direction: number;
  activeTab: string;
  currentTab: string;
  isDragging?: boolean;
  dragX?: number;
  tabValues?: string[];
  animationDuration?: number;
}) => {
  const isActive = activeTab === currentTab;
  const currentIndex = tabValues.indexOf(currentTab);
  const activeIndex = tabValues.indexOf(activeTab);

  // Calculate opacity and position based on drag
  let opacity = 1;
  let xOffset = 0;

  if (isDragging && tabValues.length > 0) {
    // If this is the active tab
    if (isActive) {
      // Reduce opacity as we drag away
      opacity = Math.max(0.5, 1 - Math.abs(dragX) / 300);
      // Move in the direction of the drag
      xOffset = dragX * 0.5;
    }
    // If this is the tab we're dragging towards (next tab when dragging left, prev tab when dragging right)
    else if ((dragX < 0 && currentIndex === activeIndex + 1) || (dragX > 0 && currentIndex === activeIndex - 1)) {
      // Increase opacity as we drag towards it
      opacity = Math.min(1, Math.abs(dragX) / 300);
      // Position it just off-screen in the direction we're coming from
      xOffset = dragX < 0 ? 100 - Math.abs(dragX) * 0.5 : -100 + Math.abs(dragX) * 0.5;
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      {(isActive || (isDragging && ((dragX < 0 && currentIndex === activeIndex + 1) || (dragX > 0 && currentIndex === activeIndex - 1)))) && (
        <motion.div
          key={currentTab}
          initial={!isDragging ? { opacity: 0, x: direction * 20 } : false}
          animate={
            isDragging
              ? { opacity, x: xOffset }
              : { opacity: 1, x: 0 }
          }
          exit={!isDragging ? { opacity: 0, x: direction * -20 } : false}
          transition={{
            opacity: { duration: isDragging ? 0 : animationDuration / 2 },
            x: { duration: isDragging ? 0 : animationDuration }
          }}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            top: 0,
            left: 0,
            pointerEvents: isActive ? 'auto' : 'none',
            zIndex: isActive ? 2 : 1
          }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Component exports
export const SwipeableTabsList = ({ children, className }: SwipeableTabsListProps) => {
  return <div className={className}>{children}</div>;
};

export const SwipeableTabsTrigger = ({ value, children, className, disabled }: SwipeableTabsTriggerProps) => {
  // This is just a wrapper component - the actual functionality is handled by TabsTrigger
  // which is rendered in the SwipeableTabs component
  return (
    <div className={cn("relative flex-shrink-0", className)} data-value={value} data-disabled={disabled}>
      {children}
    </div>
  );
};

export const SwipeableTabsContent = ({ value, children, className }: SwipeableTabsContentProps) => {
  return <div className={className} data-value={value}>{children}</div>;
};

export { SwipeableTabs };