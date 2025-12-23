import React from 'react';
import { cn } from '../../lib/utils';
import { Icon } from '@/components/ui/Icon';

interface DonationPieChartProps {
  pledges: {
    id: string;
    pageId: string;
    title: string;
    amount: number;
  }[];
  totalAmount: number;
  maxAmount: number;
  className?: string;
}

const DonationPieChart: React.FC<DonationPieChartProps> = ({
  pledges,
  totalAmount,
  maxAmount,
  className
}) => {
  // Calculate percentages for the pie chart
  const calculatePercentage = (amount: number) => {
    if (!maxAmount || maxAmount <= 0) return 0;
    return (amount / maxAmount) * 100;
  };

  // Sort pledges by amount (highest first)
  const sortedPledges = [...pledges].sort((a, b) => b.amount - a.amount);
  
  // Calculate the unused amount
  const unusedAmount = Math.max(0, maxAmount - totalAmount);
  const unusedPercentage = calculatePercentage(unusedAmount);

  // Generate the conic gradient for the pie chart
  const generateConicGradient = () => {
    let gradient = '';
    let currentPercentage = 0;
    
    // Add each pledge to the gradient
    sortedPledges.forEach((pledge, index) => {
      const pledgePercentage = calculatePercentage(pledge.amount);
      const startPercentage = currentPercentage;
      const endPercentage = currentPercentage + pledgePercentage;
      
      gradient += `#808080 ${startPercentage}% ${endPercentage}%, `;
      currentPercentage = endPercentage;
    });
    
    // Add the unused amount to the gradient
    gradient += `#f1f1f1 ${currentPercentage}% 100%`;
    
    return `conic-gradient(${gradient})`;
  };

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative w-40 h-40">
        {/* Pie chart */}
        <div 
          className="w-full h-full rounded-full"
          style={{ 
            background: generateConicGradient(),
            transform: 'rotate(-90deg)'
          }}
        ></div>
        
        {/* Center circle with total amount */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-background rounded-full m-8">
          <Icon name="DollarSign" size={20} className="text-muted-foreground mb-1" />
          <div className="text-lg font-bold">${totalAmount.toFixed(2)}</div>
          <div className="text-xs text-muted-foreground">of ${maxAmount.toFixed(2)}</div>
        </div>
      </div>
      
      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-2 mt-4">
        {sortedPledges.map((pledge) => (
          <div key={pledge.id} className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-muted-foreground mr-2"></div>
            <div className="text-sm truncate">
              <span className="font-medium">${pledge.amount.toFixed(2)}</span>
              <span className="text-muted-foreground ml-1 text-xs">{pledge.title}</span>
            </div>
          </div>
        ))}
        
        {unusedAmount > 0 && (
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-muted mr-2"></div>
            <div className="text-sm">
              <span className="font-medium">${unusedAmount.toFixed(2)}</span>
              <span className="text-muted-foreground ml-1 text-xs">Unused</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DonationPieChart;