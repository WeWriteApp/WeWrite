import React, { useState, useRef, useEffect } from 'react';
import { Minus, Plus, Info } from 'lucide-react';
import { useAuth } from '../providers/AuthProvider';
import { getUserSubscription, getPledge, updatePledge, createPledge } from '../firebase/subscription';

interface InteractivePledgeBarProps {
  pageId: string;
  pageName: string;
  onPledgeChange?: (amount: number) => void;
}

const InteractivePledgeBar: React.FC<InteractivePledgeBarProps> = ({
  pageId,
  pageName,
  onPledgeChange
}) => {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [currentPledge, setCurrentPledge] = useState<number>(0);
  const [totalPledged, setTotalPledged] = useState<number>(0);
  const [availableBudget, setAvailableBudget] = useState<number>(0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragType, setDragType] = useState<'current' | 'total' | null>(null);
  const [intervalAmount, setIntervalAmount] = useState<number>(0.1);
  const [showIntervalModal, setShowIntervalModal] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const barRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Load user subscription and pledge data
  useEffect(() => {
    const loadData = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Get user subscription
        const userSubscription = await getUserSubscription(user.uid);
        if (!userSubscription) {
          setLoading(false);
          return;
        }
        
        setSubscription(userSubscription);
        
        // Calculate total pledged and available budget
        const totalAmount = userSubscription.amount || 0;
        const pledgedAmount = userSubscription.pledgedAmount || 0;
        setTotalPledged(pledgedAmount);
        setAvailableBudget(totalAmount - pledgedAmount);
        
        // Get current pledge for this page
        const pledge = await getPledge(user.uid, pageId);
        if (pledge) {
          setCurrentPledge(pledge.amount);
        }
      } catch (error) {
        console.error('Error loading pledge data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user, pageId]);

  // Handle long press on plus/minus buttons
  const handleLongPressStart = (button: 'plus' | 'minus') => {
    longPressTimer.current = setTimeout(() => {
      setShowIntervalModal(true);
    }, 500); // 500ms long press to open interval modal
  };

  const handleLongPressEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent, type: 'current' | 'total') => {
    if (!subscription) return;
    
    setIsDragging(true);
    setDragType(type);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent, type: 'current' | 'total') => {
    if (!subscription) return;
    
    setIsDragging(true);
    setDragType(type);
    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  };

  // Handle drag movement
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging || !barRef.current) return;
    
    const rect = barRef.current.getBoundingClientRect();
    const barWidth = rect.width;
    const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / barWidth));
    
    updatePledgeFromPosition(position);
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (!isDragging || !barRef.current) return;
    
    const touch = e.touches[0];
    const rect = barRef.current.getBoundingClientRect();
    const barWidth = rect.width;
    const position = Math.max(0, Math.min(1, (touch.clientX - rect.left) / barWidth));
    
    updatePledgeFromPosition(position);
  };

  // Handle drag end
  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      savePledge();
    }
  };

  const handleTouchEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      savePledge();
    }
  };

  // Update pledge amount based on drag position
  const updatePledgeFromPosition = (position: number) => {
    if (!subscription) return;
    
    const totalAmount = subscription.amount || 0;
    
    if (dragType === 'current') {
      // Dragging the current pledge section
      const maxAvailable = totalAmount - (totalPledged - currentPledge);
      const newPledge = Math.round(position * maxAvailable * 100) / 100;
      setCurrentPledge(newPledge);
      
      if (onPledgeChange) {
        onPledgeChange(newPledge);
      }
    } else if (dragType === 'total') {
      // Dragging the total budget section (affects all pledges proportionally)
      const newTotal = Math.round(position * totalAmount * 100) / 100;
      const ratio = newTotal / totalPledged;
      const newCurrentPledge = Math.round(currentPledge * ratio * 100) / 100;
      
      setTotalPledged(newTotal);
      setCurrentPledge(newCurrentPledge);
      setAvailableBudget(totalAmount - newTotal);
      
      if (onPledgeChange) {
        onPledgeChange(newCurrentPledge);
      }
    }
  };

  // Save pledge to database
  const savePledge = async () => {
    if (!user || !subscription) return;
    
    try {
      const existingPledge = await getPledge(user.uid, pageId);
      
      if (existingPledge) {
        await updatePledge(user.uid, pageId, currentPledge, existingPledge.amount);
      } else if (currentPledge > 0) {
        await createPledge(user.uid, pageId, currentPledge);
      }
      
      // Refresh subscription data
      const updatedSubscription = await getUserSubscription(user.uid);
      if (updatedSubscription) {
        setSubscription(updatedSubscription);
        setTotalPledged(updatedSubscription.pledgedAmount || 0);
        setAvailableBudget(updatedSubscription.amount - (updatedSubscription.pledgedAmount || 0));
      }
    } catch (error) {
      console.error('Error saving pledge:', error);
    }
  };

  // Handle increment/decrement buttons
  const handleIncrement = () => {
    if (!subscription) return;
    
    const maxAvailable = subscription.amount - (totalPledged - currentPledge);
    const newPledge = Math.min(currentPledge + intervalAmount, maxAvailable);
    setCurrentPledge(newPledge);
    
    if (onPledgeChange) {
      onPledgeChange(newPledge);
    }
    
    savePledge();
  };

  const handleDecrement = () => {
    const newPledge = Math.max(currentPledge - intervalAmount, 0);
    setCurrentPledge(newPledge);
    
    if (onPledgeChange) {
      onPledgeChange(newPledge);
    }
    
    savePledge();
  };

  // Calculate percentages for the bar sections
  const getPercentages = () => {
    if (!subscription || subscription.amount === 0) {
      return { spent: 0, current: 0, available: 100 };
    }
    
    const totalAmount = subscription.amount;
    const spentPercentage = ((totalPledged - currentPledge) / totalAmount) * 100;
    const currentPercentage = (currentPledge / totalAmount) * 100;
    const availablePercentage = 100 - spentPercentage - currentPercentage;
    
    return {
      spent: spentPercentage,
      current: currentPercentage,
      available: availablePercentage
    };
  };

  const percentages = getPercentages();

  if (loading) {
    return (
      <div className="w-full h-12 bg-gray-200 dark:bg-gray-800 rounded-full animate-pulse"></div>
    );
  }

  if (!subscription) {
    return (
      <div className="w-full p-4 bg-gray-100 dark:bg-gray-800 rounded-lg text-center">
        <p className="text-sm text-muted-foreground">
          You need an active subscription to donate to this page.
        </p>
        <button 
          className="mt-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
          onClick={() => window.location.href = '/account/subscription'}
        >
          Set up subscription
        </button>
      </div>
    );
  }

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between items-center">
        <button
          className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
          onClick={handleDecrement}
          onMouseDown={() => handleLongPressStart('minus')}
          onMouseUp={handleLongPressEnd}
          onMouseLeave={handleLongPressEnd}
          onTouchStart={() => handleLongPressStart('minus')}
          onTouchEnd={handleLongPressEnd}
        >
          <Minus className="h-5 w-5" />
        </button>
        
        <div className="text-center">
          <span className="text-xl font-bold">${currentPledge.toFixed(2)}</span>
          <span className="text-sm text-muted-foreground ml-1">/mo</span>
        </div>
        
        <button
          className="p-2 rounded-full bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
          onClick={handleIncrement}
          onMouseDown={() => handleLongPressStart('plus')}
          onMouseUp={handleLongPressEnd}
          onMouseLeave={handleLongPressEnd}
          onTouchStart={() => handleLongPressStart('plus')}
          onTouchEnd={handleLongPressEnd}
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
      
      <div 
        ref={barRef}
        className="w-full h-12 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden relative cursor-pointer"
      >
        {/* Already spent section */}
        <div 
          className="h-full bg-gray-400 dark:bg-gray-600 absolute left-0 top-0"
          style={{ width: `${percentages.spent}%` }}
          onMouseDown={(e) => handleMouseDown(e, 'total')}
          onTouchStart={(e) => handleTouchStart(e, 'total')}
        ></div>
        
        {/* Current pledge section */}
        <div 
          className="h-full bg-blue-500 absolute"
          style={{ 
            left: `${percentages.spent}%`, 
            width: `${percentages.current}%` 
          }}
          onMouseDown={(e) => handleMouseDown(e, 'current')}
          onTouchStart={(e) => handleTouchStart(e, 'current')}
        ></div>
        
        {/* Available budget section is the remaining space */}
      </div>
      
      <div className="flex justify-between text-xs text-muted-foreground">
        <div>
          <span>Other pages: ${(totalPledged - currentPledge).toFixed(2)}</span>
        </div>
        <div>
          <span>Available: ${availableBudget.toFixed(2)}</span>
        </div>
      </div>
      
      {/* Interval setting modal */}
      {showIntervalModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-background p-6 rounded-lg shadow-lg max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Set Increment Amount</h3>
            
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Choose how much to change the pledge amount with each click.
              </p>
              
              <div className="grid grid-cols-3 gap-2">
                {[0.01, 0.05, 0.1, 0.25, 0.5, 1].map((amount) => (
                  <button
                    key={amount}
                    className={`p-2 border rounded-md ${
                      intervalAmount === amount 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-background hover:bg-accent'
                    }`}
                    onClick={() => setIntervalAmount(amount)}
                  >
                    ${amount.toFixed(2)}
                  </button>
                ))}
              </div>
              
              <div className="flex justify-end mt-4">
                <button
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
                  onClick={() => setShowIntervalModal(false)}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InteractivePledgeBar;
