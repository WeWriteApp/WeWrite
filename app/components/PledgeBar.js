"use client";
import React, { useState, useEffect, useRef, useContext } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { useParams } from "next/navigation";
import { PortfolioContext } from "@/providers/PortfolioProvider";
import styles from './PledgeBar.module.css';

const intervalOptions = [
  { value: 0.01, label: '0.01' },
  { value: 0.1, label: '0.10' },
  { value: 1, label: '1.00' },
  { value: 10, label: '10.00' },
];

const LoadingSkeleton = () => (
  <div className="w-11/12 sm:max-w-[300px] space-y-6 bg-white rounded-lg p-6 shadow-sm animate-pulse">
    <div className="space-y-4">
      <div className="h-6 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
    <div className="h-12 bg-gray-200 rounded"></div>
    <div className="flex justify-between">
      <div className="h-10 w-10 bg-gray-200 rounded-md"></div>
      <div className="h-10 w-20 bg-gray-200 rounded-md"></div>
      <div className="h-10 w-10 bg-gray-200 rounded-md"></div>
    </div>
  </div>
);

const ErrorDisplay = ({ error, onRetry }) => (
  <div className="w-11/12 sm:max-w-[300px] space-y-4 bg-white rounded-lg p-6 shadow-sm border border-red-200">
    <div className="flex items-center gap-2 text-red-600">
      <Icon icon="mdi:alert-circle" width="24" height="24" />
      <h2 className="text-lg font-semibold">Error</h2>
    </div>
    <p className="text-sm text-red-600">{error?.message || 'Failed to load subscription data'}</p>
    {onRetry && (
      <button
        onClick={onRetry}
        className="w-full px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-md transition-colors"
      >
        Try Again
      </button>
    )}
  </div>
);

const PledgeBar = () => {
  const { subscriptions, totalSubscriptionsCost, addSubscription } = useContext(PortfolioContext);
  const [amount, setAmount] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [displayMode, setDisplayMode] = useState('amount');
  const [menuVisible, setMenuVisible] = useState(false);
  const [customVisible, setCustomVisible] = useState(false);
  const [customCheck, setCustomCheck] = useState(false);
  const [interval, setInterval] = useState(1);
  const [inputVisible, setInputVisible] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [usedAmount, setUsedAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const progressBarWidth = (value, total) => {
    if (!total || total <= 0) return '0%';
    const percentage = (value / total) * 100;
    return `${Math.min(Math.max(percentage, 0), 100)}%`;
  };

  const timerRef = useRef(null);
  const textRef = useRef(null);
  const { id } = useParams();

  useEffect(() => {
    try {
      setIsLoading(true);
      if (totalSubscriptionsCost) {
        setAmount(totalSubscriptionsCost);
        const used = subscriptions
          .filter(sub => sub.id !== id)
          .reduce((total, sub) => total + sub.amount, 0);
        setUsedAmount(used);
        const currentSubscription = subscriptions.find(sub => sub.id === id);
        if (currentSubscription) {
          setIsSubscribed(true);
          setAmount(currentSubscription.amount);
          setPercentage((currentSubscription.amount / totalSubscriptionsCost) * 100);
        }
      } else {
        setAmount(10);
        setPercentage(0);
      }
      setError(null);
    } catch (err) {
      console.error('Error processing subscription data:', err);
      setError(err instanceof Error ? err : new Error('Failed to process subscription data'));
    } finally {
      setTimeout(() => setIsLoading(false), 300);
    }
  }, [subscriptions, totalSubscriptionsCost, id]);

  const handleMouseDown = () => {
    timerRef.current = setTimeout(() => setMenuVisible(true), 500);
  };

  const handleMouseUp = () => {
    clearTimeout(timerRef.current);
  };

  const handleAdjustInterval = (newInterval) => {
    setInterval(newInterval);
    setMenuVisible(false);
  };

  const handleClickOutside = (event) => {
    if (textRef.current && !textRef.current.contains(event.target)) {
      setInputVisible(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(timerRef.current);
    };
  }, []);

  const handleAmountChange = (newAmount) => {
    if (newAmount >= 0 && newAmount <= (totalSubscriptionsCost || 10)) {
      setAmount(newAmount);
      setPercentage((newAmount / (totalSubscriptionsCost || 10)) * 100);
      addSubscription(newAmount, id);
    }
  };

  const handlePercentageChange = (newPercentage) => {
    if (newPercentage >= 0 && newPercentage <= 100) {
      setPercentage(newPercentage);
      const newAmount = ((newPercentage / 100) * (totalSubscriptionsCost || 10));
      setAmount(newAmount);
      addSubscription(newAmount, id);
    }
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={() => window.location.reload()} />;
  }

  return (
    <div className="w-11/12 sm:max-w-[300px] space-y-6 bg-white rounded-lg p-6 shadow-sm">
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b pb-4">
          <h2 className="text-xl font-semibold text-gray-900">Subscription Amount</h2>
          <button
            onClick={() => setDisplayMode(displayMode === 'amount' ? 'percentage' : 'amount')}
            className="px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
          >
            Switch to {displayMode === 'amount' ? 'Percentage' : 'Amount'}
          </button>
        </div>

        <div className="flex items-center justify-between text-gray-600">
          <span className="text-sm">
            {displayMode === 'amount'
              ? `Total Budget: $${totalSubscriptionsCost || 10}/mo`
              : 'Percentage Allocation'
            }
          </span>
          {isSubscribed && (
            <span className="text-sm text-green-600 font-medium">
              Active Subscription
            </span>
          )}
        </div>
      </div>

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
                inputmode="decimal"
                autoFocus
                className="w-[100px] bg-transparent outline-none"
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
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
              {interval === value && <Icon icon="mdi:check" width="24" height="24" className="text-blue-500" />}
            </div>
          ))}
          <div
            className="p-3 cursor-pointer flex w-full justify-between active:bg-active-bar"
            onClick={() => {
              setCustomVisible(true);
              setMenuVisible(false);
            }}
          >
            <div className="flex flex-row gap-2 text-[17px]">
              <span className="font-medium text-gray-46">$</span>
              <span>{`${interval}`}</span>
              <span className="font-medium text-gray-46">custom</span>
            </div>
            {customCheck ? (
              <Icon icon="mdi:check" width="24" height="24" className="text-blue-500" />
            ) : (
              <Icon icon="mdi:keyboard-arrow-right" width="24" height="24" />
            )}
          </div>
        </div>
      )}

      <div className="sm:max-w-[300px] w-full z-10 relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50 min-h-[48px]">
        {/* Gray area for other pages */}
        {usedAmount > 0 && (
          <div
            className={`h-full rounded-l-[21px] absolute ${styles['bg-reactangle']} overflow-hidden z-10`}
            style={{
              width: progressBarWidth(usedAmount, totalSubscriptionsCost || 10),
              transition: 'width 0.3s ease-in-out'
            }}
          >
            <div className="h-full left-[-25px] top-[-25px] flex gap-3 absolute">
              {Array.from({ length: Math.ceil(usedAmount) + 30 }, (_, index) => (
                <div key={index} className={`w-[6px] h-[calc(100%+50px)] ${styles['bg-reactangle']} rotate-45`}></div>
              ))}
            </div>
          </div>
        )}

        {/* Blue bar for current allocation */}
        <div
          style={{
            width: progressBarWidth(amount, totalSubscriptionsCost || 10),
            left: usedAmount > 0 ? progressBarWidth(usedAmount, totalSubscriptionsCost || 10) : '0%',
            transition: 'width 0.3s ease-in-out, left 0.3s ease-in-out'
          }}
          className={`absolute h-full z-20 ${isSubscribed ? `${styles['bg-active-bar']} ${styles['active-bar']}` : styles['bg-gray-bar']}`}
        ></div>

        <div className="flex gap-4 justify-between p-4">
          <button
            className="w-10 h-10 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            onClick={() => {
              if (displayMode === 'amount') {
                handleAmountChange(amount - interval);
              } else {
                handlePercentageChange(percentage - 5);
              }
            }}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUp}
          >
            <Icon icon="mdi:minus" width="20" height="20" />
          </button>

          <div
            className="flex justify-center items-center gap-1 text-lg"
            onDoubleClick={() => setInputVisible(true)}
          >
            {displayMode === 'amount' ? (
              <>
                <span className="text-gray-600">$</span>
                {inputVisible ? (
                  <input
                    type="number"
                    ref={textRef}
                    className="w-20 text-center bg-white border rounded-md py-1 text-gray-900"
                    value={amount}
                    onChange={(e) => handleAmountChange(Number(e.target.value))}
                    autoComplete="off"
                  />
                ) : (
                  <span className="font-medium text-gray-900">
                    {amount.toFixed(2)}
                  </span>
                )}
                <span className="text-gray-600">/mo</span>
              </>
            ) : (
              <>
                {inputVisible ? (
                  <input
                    type="number"
                    ref={textRef}
                    className="w-20 text-center bg-white border rounded-md py-1 text-gray-900"
                    value={percentage}
                    onChange={(e) => handlePercentageChange(Number(e.target.value))}
                    autoComplete="off"
                  />
                ) : (
                  <span className="font-medium text-gray-900">
                    {percentage.toFixed(1)}%
                  </span>
                )}
              </>
            )}
          </div>

          <button
            className="w-10 h-10 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors"
            onClick={() => {
              if (displayMode === 'amount') {
                handleAmountChange(amount + interval);
              } else {
                handlePercentageChange(percentage + 5);
              }
            }}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUp}
          >
            <Icon icon="mdi:plus" width="20" height="20" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PledgeBar;
