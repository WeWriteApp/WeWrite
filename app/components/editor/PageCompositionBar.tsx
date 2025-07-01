import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../../lib/utils';
import { AlertCircle } from 'lucide-react';

interface OtherPledge {
  id: string;
  pageId: string;
  title: string;
  amount: number;
  color: string;
}

interface PageCompositionBarProps {
  pageId: string;
  pageTitle: string;
  amount: number;
  maxAmount: number;
  otherPledges: OtherPledge[];
  onAmountChange?: (newAmount: number) => void;
  className?: string;
}

const PageCompositionBar: React.FC<PageCompositionBarProps> = ({
  pageId,
  pageTitle,
  amount,
  maxAmount,
  otherPledges,
  onAmountChange,
  className
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const [currentAmount, setCurrentAmount] = useState(amount);
  const barRef = useRef<HTMLDivElement>(null);
  const [isMaxedOut, setIsMaxedOut] = useState(false);

  // Calculate total pledged amount
  const totalOtherPledges = otherPledges.reduce((sum, pledge) => sum + pledge.amount, 0);
  const totalPledged = totalOtherPledges + currentAmount;

  // Calculate percentages
  const calculatePercentage = (value: number) => {
    if (!maxAmount || maxAmount <= 0) return 0;
    return Math.min(100, (value / maxAmount) * 100);
  };

  const currentPercentage = calculatePercentage(currentAmount);
  const otherPledgesPercentage = calculatePercentage(totalOtherPledges);
  const totalPercentage = calculatePercentage(totalPledged);

  // Check if maxed out
  useEffect(() => {
    setIsMaxedOut(totalPledged >= maxAmount);
  }, [totalPledged, maxAmount]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    setStartX(e.clientX);

    if (barRef.current) {
      const rect = barRef.current.getBoundingClientRect();
      setStartWidth(rect.width * (currentPercentage / 100));
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !barRef.current) return;

    const rect = barRef.current.getBoundingClientRect();
    const deltaX = e.clientX - startX;
    const newWidth = Math.max(0, Math.min(rect.width - (rect.width * (otherPledgesPercentage / 100)), startWidth + deltaX));
    const newPercentage = (newWidth / rect.width) * 100;
    const newAmount = (newPercentage / 100) * maxAmount;

    setCurrentAmount(newAmount);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);

    if (onAmountChange) {
      onAmountChange(currentAmount);
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="flex justify-between items-center mb-2">
        <div className="text-sm font-medium truncate">{pageTitle}</div>
        <div className="text-sm font-medium">${currentAmount.toFixed(2)}</div>
      </div>

      <div
        ref={barRef}
        className="relative h-8 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer"
      >
        {/* Other pledges visualization - sorted by amount */}
        {otherPledges
          .sort((a, b) => b.amount - a.amount) // Sort by amount (highest first)
          .map((pledge, index) => {
            // Calculate position
            const previousPledgesAmount = otherPledges
              .sort((a, b) => b.amount - a.amount)
              .slice(0, index)
              .reduce((sum, p) => sum + p.amount, 0);

            const previousPercentage = calculatePercentage(previousPledgesAmount);
            const pledgePercentage = calculatePercentage(pledge.amount);

            // Add small gap between segments
            const gapWidth = 0.5;
            const adjustedWidth = Math.max(0, pledgePercentage - gapWidth);
            const adjustedLeft = previousPercentage + (gapWidth / 2);

            return (
              <div
                key={`other-${pledge.id}`}
                className="absolute h-full tooltip-trigger"
                style={{
                  left: `${adjustedLeft}%`,
                  width: `${adjustedWidth}%`,
                  backgroundColor: '#808080', // Use grey for all other pledges
                  borderRadius: '4px',
                  transition: 'all 0.3s ease'
                }}
                data-tooltip={`${pledge.title}: $${pledge.amount.toFixed(2)}`}
              ></div>
            );
        })}

        {/* Current pledge visualization */}
        <div
          className={cn(
            "absolute h-full tooltip-trigger",
            isMaxedOut ? "bg-orange-500" : "bg-blue-500" // Current pledge is blue or orange if maxed out
          )}
          style={{
            left: `${otherPledgesPercentage + 0.25}%`,
            width: `${Math.max(0, currentPercentage - 0.5)}%`,
            borderRadius: '4px',
            transition: isDragging ? 'none' : 'all 0.3s ease'
          }}
          onMouseDown={handleMouseDown}
          data-tooltip={`${pageTitle}: $${currentAmount.toFixed(2)}`}
        >
          {/* Drag handle */}
          <div
            className="absolute right-0 top-0 bottom-0 w-4 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
            onMouseDown={handleMouseDown}
          >
            <div className="w-1 h-4 bg-white rounded-full"></div>
          </div>
        </div>

        {/* Warning icon for maxed out */}
        {isMaxedOut && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-white">
            <AlertCircle className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
};

export default PageCompositionBar;