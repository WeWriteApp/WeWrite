"use client";

import React, { useState, useEffect } from 'react';
import { Minus, Plus, DollarSign, X } from 'lucide-react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { updatePledge, getUserSubscription } from '../firebase/subscription';

interface PledgeBarTransformProps {
  isOpen: boolean;
  onClose: () => void;
  pledgeData: {
    pageId: string;
    pageTitle: string;
    amount: number;
    available: number;
    subscription: any;
    userId: string;
  };
  onPledgeChange: (amount: number) => void;
}

const PledgeBarTransform: React.FC<PledgeBarTransformProps> = ({
  isOpen,
  onClose,
  pledgeData,
  onPledgeChange
}) => {
  const [amount, setAmount] = useState(pledgeData.amount || 0);
  const [intervalAmount, setIntervalAmount] = useState(0.1);
  const [otherPledges, setOtherPledges] = useState<any[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [subscriptionAmount, setSubscriptionAmount] = useState(
    pledgeData.subscription?.amount || 0
  );

  // Initialize state from props
  useEffect(() => {
    setAmount(pledgeData.amount || 0);
    setSubscriptionAmount(pledgeData.subscription?.amount || 0);
    
    // Calculate other pledges
    if (pledgeData.subscription?.pledges) {
      const others = Object.values(pledgeData.subscription.pledges)
        .filter((pledge: any) => pledge.pageId !== pledgeData.pageId)
        .sort((a: any, b: any) => b.amount - a.amount);
      setOtherPledges(others);
    }
  }, [pledgeData]);

  // Handle increment
  const handleIncrement = () => {
    const newAmount = Math.min(
      amount + intervalAmount,
      subscriptionAmount - getTotalOtherPledges()
    );
    setAmount(parseFloat(newAmount.toFixed(2)));
    savePledge(newAmount);
  };

  // Handle decrement
  const handleDecrement = () => {
    const newAmount = Math.max(0, amount - intervalAmount);
    setAmount(parseFloat(newAmount.toFixed(2)));
    savePledge(newAmount);
  };

  // Get total of other pledges
  const getTotalOtherPledges = () => {
    return otherPledges.reduce((sum, pledge) => sum + (pledge.amount || 0), 0);
  };

  // Save pledge to database
  const savePledge = async (newAmount: number) => {
    if (!pledgeData.userId || !pledgeData.pageId) return;
    
    setIsUpdating(true);
    try {
      await updatePledge(
        pledgeData.userId,
        pledgeData.pageId,
        newAmount,
        pledgeData.amount || 0
      );
      onPledgeChange(newAmount);
    } catch (error) {
      console.error('Error updating pledge:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  // Handle subscription amount change
  const handleSubscriptionChange = async (newAmount: number) => {
    // This would update the user's subscription amount
    // Implementation would depend on your subscription service
    setSubscriptionAmount(newAmount);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-300">
      <div className="bg-background p-6 rounded-lg shadow-lg max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">{pledgeData.pageTitle}</h2>
          <button 
            onClick={onClose}
            className="p-1 rounded-full hover:bg-accent"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Current pledge section */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Your pledge:</span>
              <span className="text-lg font-bold">${amount.toFixed(2)}/mo</span>
            </div>
            
            <div className="flex items-center justify-between gap-4 mb-4">
              <button
                onClick={handleDecrement}
                disabled={amount <= 0 || isUpdating}
                className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                <Minus size={16} />
              </button>
              
              <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 dark:bg-blue-600"
                  style={{ width: `${(amount / subscriptionAmount) * 100}%` }}
                ></div>
              </div>
              
              <button
                onClick={handleIncrement}
                disabled={amount >= subscriptionAmount - getTotalOtherPledges() || isUpdating}
                className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          
          {/* Interval adjustment */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Adjustment interval:</span>
              <span className="text-sm">${intervalAmount.toFixed(2)}</span>
            </div>
            
            <div className="grid grid-cols-5 gap-2">
              {[0.01, 0.05, 0.1, 0.5, 1].map((value) => (
                <button
                  key={value}
                  onClick={() => setIntervalAmount(value)}
                  className={`p-2 text-xs rounded ${
                    intervalAmount === value 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  ${value.toFixed(2)}
                </button>
              ))}
            </div>
          </div>
          
          {/* Other pledges */}
          {otherPledges.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-2">Your other pledges:</h3>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {otherPledges.map((pledge, index) => (
                  <div key={index} className="flex justify-between items-center text-sm">
                    <span className="truncate flex-1">{pledge.title || 'Untitled Page'}</span>
                    <span className="font-medium">${pledge.amount?.toFixed(2) || '0.00'}/mo</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Subscription amount */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium">Monthly budget:</span>
              <span className="text-sm">${subscriptionAmount.toFixed(2)}/mo</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => handleSubscriptionChange(subscriptionAmount + 10)}
                className="text-xs"
              >
                <DollarSign size={12} className="mr-1" />
                Increase budget
              </Button>
              
              <div className="text-xs text-muted-foreground">
                Available: ${(subscriptionAmount - getTotalOtherPledges() - amount).toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PledgeBarTransform;
