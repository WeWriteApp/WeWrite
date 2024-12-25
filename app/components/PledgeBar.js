"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
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

const PledgeBar = ({ user, pageId }) => {
  const { subscriptions, totalSubscriptionsCost, totalAllocatedPercentage, addSubscription } = React.useContext(PortfolioContext);
  const [amount, setAmount] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [displayMode, setDisplayMode] = useState('amount');
  const [menuVisible, setMenuVisible] = useState(false);
  const [customVisible, setCustomVisible] = useState(false);
  const [customCheck, setCustomCheck] = useState(false);
  const [interval, setInterval] = useState(1);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [usedAmount, setUsedAmount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const timerRef = useRef(null);

  const progressBarWidth = useCallback((value, total) => {
    if (!total || total <= 0) return '0%';
    const percentage = ((value || 0) / total) * 100;
    return `${Math.min(Math.max(percentage, 0), 100)}%`;
  }, []);

  const handleMouseDown = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
    timerRef.current = setTimeout(() => setMenuVisible(true), 500);
  }, []);

  const handleMouseUp = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  }, []);

  const handleAdjustInterval = useCallback((newInterval) => {
    setInterval(newInterval);
    setMenuVisible(false);
  }, []);

  const handleCustomIntervalClose = useCallback(() => {
    setCustomVisible(false);
    setCustomCheck(true);
  }, []);

  const handleCustomIntervalOpen = useCallback(() => {
    setCustomVisible(true);
    setMenuVisible(false);
  }, []);

  const handleDisplayModeToggle = useCallback(() => {
    setDisplayMode(prev => prev === 'amount' ? 'percentage' : 'amount');
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 500));

        if (totalSubscriptionsCost) {
          const used = subscriptions
            .filter(sub => sub.id !== pageId)
            .reduce((total, sub) => total + sub.amount, 0);
          setUsedAmount(used);

          const currentSubscription = subscriptions.find(sub => sub.id === pageId);
          if (currentSubscription) {
            setIsSubscribed(true);
            setAmount(currentSubscription.amount);
            setPercentage(currentSubscription.percentage);
          } else {
            setAmount(0);
            setPercentage(0);
          }
        } else {
          setAmount(0);
          setPercentage(0);
          setUsedAmount(0);
        }
        setError(null);
      } catch (err) {
        console.error('Error processing subscription data:', err);
        setError(err instanceof Error ? err : new Error('Failed to process subscription data'));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [subscriptions, totalSubscriptionsCost, pageId]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (error) {
    return <ErrorDisplay error={error} onRetry={() => window.location.reload()} />;
  }

  const renderMenu = () => {
    if (!menuVisible) return null;
    return (
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
          onClick={handleCustomIntervalOpen}
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
    );
  };

  const renderCustomInterval = () => {
    if (!customVisible) return null;
    return (
      <div className="sm:max-w-[300px] w-full z-10 mb-4 flex flex-col adjust-box rounded-xl text-[17px] p-3 gap-3">
        <div className="flex items-center justify-center">
          <Icon
            icon="mdi:close"
            width="24"
            height="24"
            className="absolute left-3 rounded-full border-2 cursor-pointer active:text-blue-500"
            onClick={handleCustomIntervalClose}
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
              onChange={(e) => setInterval(Number(e.target.value))}
              autoComplete="off"
            />
          </div>
          <span className="font-medium text-gray-46">per month</span>
        </div>
      </div>
    );
  };

  return (
    <div className="w-11/12 sm:max-w-[300px] space-y-6 bg-white rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-medium">Pledge</h3>
          <button
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="text-gray-500 hover:text-gray-700"
          >
            <Icon icon="heroicons:clock" className="w-5 h-5" />
          </button>
        </div>
        <button
          onClick={handleDisplayModeToggle}
          className="text-gray-500 hover:text-gray-700"
        >
          <Icon
            icon={displayMode === 'amount' ? 'heroicons:currency-dollar' : 'heroicons:percent'}
            className="w-5 h-5"
          />
        </button>
      </div>

      {renderMenu()}
      {renderCustomInterval()}

      <div className="relative h-[42px] rounded-[21px] bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-l-[21px] absolute ${styles['bg-rectangle']} overflow-hidden`}
          style={{ width: progressBarWidth(usedAmount || 0, totalSubscriptionsCost || 10) }}
        >
          <div className="h-full left-[-25px] top-[-25px] flex gap-3 absolute">
            {Array.from({ length: Math.ceil((usedAmount || 0) + 30) }, (_, index) => (
              <div
                key={index}
                className={`w-[6px] h-[calc(100%+50px)] ${styles['bg-rectangle']} rotate-45`}
              />
            ))}
          </div>
        </div>

        <div
          style={{
            width: progressBarWidth(amount || 0, totalSubscriptionsCost || 10),
            left: progressBarWidth(usedAmount || 0, totalSubscriptionsCost || 10),
          }}
          className={`absolute h-full ${
            isSubscribed ? `${styles['bg-active-bar']} ${styles['active-bar']}` : styles['bg-gray-bar']
          }`}
        />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">
            {displayMode === 'amount' ? `$${amount.toFixed(2)}` : `${percentage.toFixed(1)}%`}
          </span>
          <span className="text-sm text-gray-500">
            {displayMode === 'amount'
              ? `/ $${totalSubscriptionsCost || 10}`
              : `/ 100%`}
          </span>
        </div>
        <button
          onClick={() => addSubscription({ id: pageId, percentage })}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          disabled={percentage === 0}
        >
          {isSubscribed ? 'Update' : 'Subscribe'}
        </button>
      </div>
    </div>
  );
};

export default PledgeBar;
