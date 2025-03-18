"use client";
import React, { useState, useEffect, useRef, useContext } from "react";
import { Check, ChevronRight, Minus, Plus } from "lucide-react";
import { useParams } from "next/navigation";
import { AuthContext } from "../providers/AuthProvider";
import { getUserSubscription, getPledge, createPledge, updatePledge } from "../firebase/subscription";
import Link from "next/link";
import { Icon } from "@iconify/react";
import { PillLink } from "./PillLink";

const intervalOptions = [
  { value: 0.01, label: '0.01' },
  { value: 0.1, label: '0.10' },
  { value: 1, label: '1.00' },
  { value: 10, label: '10.00' },
];

const PledgeBar = () => {
  const { user } = useContext(AuthContext);
  const [subscription, setSubscription] = useState(null);
  const [donateAmount, setDonateAmount] = useState(0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [customVisible, setCustomVisible] = useState(false);
  const [customCheck, setCustomCheck] = useState(false);
  const [interval, setInterval] = useState(1);
  const [inputVisible, setInputVisible] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [maxedOut, setMaxedOut] = useState(false);

  const timerRef = useRef(null);
  const textRef = useRef(null);
  const { id: pageId } = useParams();

  // Load user subscription and pledge data
  useEffect(() => {
    const loadData = async () => {
      if (!user || !pageId) return;
      
      try {
        // Get subscription data
        const userSubscription = await getUserSubscription(user.uid);
        setSubscription(userSubscription);
        
        // Get pledge for this page if exists
        const pledge = await getPledge(user.uid, pageId);
        if (pledge) {
          setDonateAmount(pledge.amount);
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading subscription data:", error);
        setLoading(false);
      }
    };
    
    loadData();
  }, [user, pageId]);

  // Handle pledge amount change
  const handleAmountChange = async (change) => {
    if (!user || !subscription) return;
    
    const newAmount = donateAmount + (change * interval);
    const usedAmount = subscription.pledgedAmount || 0;
    const availableAmount = subscription.amount - usedAmount + donateAmount;
    
    if (newAmount >= 0 && newAmount <= availableAmount) {
      setDonateAmount(newAmount);
      
      // Check if pledged amount would max out subscription
      if (newAmount > 0 && newAmount + usedAmount - donateAmount >= subscription.amount) {
        setMaxedOut(true);
      } else {
        setMaxedOut(false);
      }
    }
  };

  const handleInteraction = () => {
    if (!user) {
      return true; // Block interaction for non-logged in users
    }
    
    if (!subscription || subscription.status !== 'active') {
      return true; // Block interaction for users without active subscription
    }
    
    return false; // Allow interaction
  };

  const handleMouseDown = () => {
    if (!handleInteraction()) {
      timerRef.current = setTimeout(() => setMenuVisible(true), 500);
    }
  };

  const handleMouseUp = () => {
    clearTimeout(timerRef.current);
  };

  const handleAdjustInterval = (newInterval) => {
    if (!handleInteraction()) {
      setInterval(newInterval);
      setMenuVisible(false);
    }
  };

  const handleClickOutside = (event) => {
    if (textRef.current && !textRef.current.contains(event.target)) {
      setInputVisible(false);
    }
  };
  
  // Save pledge changes
  const savePledge = async () => {
    if (!user || !pageId || donateAmount === 0) return;
    
    try {
      const existingPledge = await getPledge(user.uid, pageId);
      
      if (existingPledge) {
        // Update existing pledge
        await updatePledge(user.uid, pageId, donateAmount, existingPledge.amount);
      } else {
        // Create new pledge
        await createPledge(user.uid, pageId, donateAmount);
      }
      
      setIsConfirmed(true);
    } catch (error) {
      console.error("Error saving pledge:", error);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(timerRef.current);
    };
  }, []);
  
  // When donateAmount changes, mark as unconfirmed until saved
  useEffect(() => {
    if (user && pageId) {
      setIsConfirmed(false);
    }
  }, [donateAmount]);

  const progressBarWidth = (value, total) => (total > 0 ? `${(value / total) * 100}%` : '0%');
  
  if (loading) {
    return (
      <div className="w-11/12 sm:max-w-[300px] mx-auto">
        <div className="sm:max-w-[300px] w-full z-10 relative border-gradient overflow-hidden opacity-50">
          <div className="flex gap-2 justify-between p-2">
            <div className="w-action-button h-action-button action-button-gradient p-[8px_8px] flex items-center justify-center">
              <div className="text-foreground h-6 w-6" />
            </div>
            <div className="flex justify-center items-center text-foreground gap-1 text-[18px]">
              <span className="text-[24px] font-normal text-foreground">Loading...</span>
            </div>
            <div className="w-action-button h-action-button action-button-gradient p-[8px_8px] flex items-center justify-center">
              <div className="text-foreground h-6 w-6" />
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="w-11/12 sm:max-w-[300px] mx-auto">
        <PillLink href="/auth/login" className="w-full text-center">
          Sign in to support this page
        </PillLink>
      </div>
    );
  }
  
  if (!subscription || subscription.status !== 'active') {
    return (
      <div className="w-11/12 sm:max-w-[300px] mx-auto">
        <PillLink href="/account/subscription" className="w-full text-center">
          Subscribe to support this page
        </PillLink>
      </div>
    );
  }
  
  const usedAmount = subscription.pledgedAmount || 0;
  const totalBudget = subscription.amount || 0;
  const availableAmount = totalBudget - usedAmount + donateAmount;

  return (
    <>
      <div className="w-11/12 sm:max-w-[300px] mx-auto">
        {maxedOut && (
          <div className="mb-4 p-4 bg-orange-600 text-white rounded-xl">
            <h3 className="font-semibold mb-2">Your budget is maxed out!</h3>
            <p className="text-sm mb-4">Visit your budget page to add funds or adjust your pledges.</p>
            <div className="flex gap-4">
              <button 
                className="flex-1 py-2 px-3 bg-orange-700 hover:bg-orange-800 rounded-lg transition-colors"
                onClick={() => setMaxedOut(false)}
              >
                Dismiss
              </button>
              <Link 
                href="/account/subscription"
                className="flex-1 py-2 px-3 bg-white text-orange-600 hover:bg-gray-100 rounded-lg text-center transition-colors"
              >
                Add funds
              </Link>
            </div>
          </div>
        )}
        
        {customVisible && (
          <div className="sm:max-w-[300px] w-full z-10 mb-4 flex flex-col adjust-box rounded-xl text-[17px] p-3 gap-3">
            <div className="flex items-center justify-center">
              <Icon
                icon="mdi:close"
                width="24"
                height="24"
                className="absolute left-3 rounded-full border-2 cursor-pointer active:text-blue-500"
                onClick={() => {
                  setCustomVisible(false);
                  setCustomCheck(true);
                }}
              />
              <h3 className="text-center text-[17px]">Custom pledge interval</h3>
            </div>
            <div className="flex flex-row border-2 border-blue-500 p-4 rounded-xl justify-between">
              <div className="flex flex-row gap-2">
                <span className="font-medium text-gray-46">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  autoFocus
                  className="w-[100px] bg-transparent outline-none"
                  value={interval}
                  onChange={(e) => !handleInteraction() && setInterval(Number(e.target.value))}
                  autoComplete="off"
                />
              </div>
              <span className="font-medium text-gray-46">per month</span>
            </div>
          </div>
        )}

        {menuVisible && (
          <div className="sm:max-w-[300px] w-full z-10 mb-4 flex flex-col divide-y divide-gray-30 adjust-box rounded-xl text-[17px]">
            <h3 className="p-3 text-center">+/- Increment Amount</h3>
            {intervalOptions.map(({ value, label }) => (
              <div
                key={value}
                className="p-3 cursor-pointer flex w-full justify-between active:bg-active-bar"
                onClick={() => handleAdjustInterval(value)}
              >
                <div className="flex flex-row gap-2 text-[17px]">
                  <span className="font-medium text-gray-46">$</span>
                  <span>{label}</span>
                </div>
                {interval === value && <Check className="h-6 w-6 text-blue-500" />}
              </div>
            ))}
            <div
              className="p-3 cursor-pointer flex w-full justify-between active:bg-active-bar"
              onClick={() => {
                if (!handleInteraction()) {
                  setCustomVisible(true);
                  setMenuVisible(false);
                }
              }}
            >
              <div className="flex flex-row gap-2 text-[17px]">
                <span className="font-medium text-gray-46">$</span>
                <span>{`${interval}`}</span>
                <span className="font-medium text-gray-46">custom</span>
              </div>
              {customCheck ? (
                <Check className="h-6 w-6 text-blue-500" />
              ) : (
                <ChevronRight className="h-6 w-6" />
              )}
            </div>
          </div>
        )}

        <div className="sm:max-w-[300px] w-full z-10 relative border-gradient overflow-hidden">
          <div
            className="h-full rounded-l-[21px] absolute bg-reactangle overflow-hidden"
            style={{ width: progressBarWidth(usedAmount - donateAmount, totalBudget) }}
          >
            <div className="h-full left-[-25px] top-[-25px] flex gap-3 absolute">
              {Array.from({ length: 30 }, (_, index) => (
                <div key={index} className="w-[6px] h-[calc(100%+50px)] bg-reactangle rotate-45"></div>
              ))}
            </div>
          </div>

          <div
            style={{
              width: progressBarWidth(donateAmount, totalBudget),
              left: progressBarWidth(usedAmount - donateAmount, totalBudget),
            }}
            className={`absolute h-full ${isConfirmed ? 'bg-active-bar active-bar' : 'bg-gray-bar'}`}
          ></div>

          <div className="flex gap-2 justify-between p-2">
            <div
              className="w-action-button h-action-button action-button-gradient p-[8px_8px] flex items-center justify-center cursor-pointer active:scale-95 duration-300 backdrop-blur-sm"
              onClick={() => handleAmountChange(-1)}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchEnd={handleMouseUp}
            >
              <button
                className="text-foreground hover:text-foreground/80 flex items-center justify-center w-full h-full"
              >
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  viewBox="0 0 24 24" 
                  width="24" 
                  height="24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  className="h-6 w-6 stroke-foreground"
                >
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            </div>

            <div
              className="flex justify-center items-center text-foreground gap-1 text-[18px] z-10"
              onDoubleClick={() => !handleInteraction() && setInputVisible(true)}
            >
              $
              {inputVisible ? (
                <input
                  type="number"
                  ref={textRef}
                  className="w-[80px] h-full focus-text text-center text-[24px] text-foreground"
                  value={donateAmount}
                  onChange={(e) => {
                    if (!handleInteraction()) {
                      const value = Number(e.target.value);
                      if (value <= availableAmount) setDonateAmount(value);
                    }
                  }}
                  onBlur={() => {
                    if (donateAmount > 0) {
                      savePledge();
                    }
                  }}
                  autoComplete="off"
                />
              ) : (
                <span className="text-[24px] font-normal text-foreground">
                  {donateAmount.toFixed(2)}
                </span>
              )}
              <span className="text-foreground">/mo</span>
            </div>

            <div
              className="w-action-button h-action-button action-button-gradient p-[8px_8px] flex items-center justify-center cursor-pointer active:scale-95 duration-300 backdrop-blur-sm"
              onClick={() => handleAmountChange(1)}
              onMouseDown={handleMouseDown}
              onMouseUp={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchEnd={handleMouseUp}
            >
              <button
                className="text-foreground hover:text-foreground/80 flex items-center justify-center w-full h-full"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6 stroke-foreground"
                >
                  <line x1="12" y1="5" x2="12" y2="19"></line>
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {!isConfirmed && (
          <div className="flex justify-center mt-2">
            <button
              onClick={savePledge}
              className="px-4 py-1 text-sm bg-[#0057FF] hover:bg-[#0046CC] text-white rounded-full transition-colors"
            >
              Save Pledge
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default PledgeBar;
