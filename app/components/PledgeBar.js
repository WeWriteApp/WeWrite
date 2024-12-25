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

const PledgeBar = ({ user, pageId, onSubscribe }) => {
  const { subscriptions, totalSubscriptionsCost, totalAllocatedPercentage, addSubscription } = React.useContext(PortfolioContext);
  const [amount, setAmount] = useState(0);
  const [percentage, setPercentage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Debug logging
  useEffect(() => {
    console.log('PledgeBar state:', {
      amount,
      percentage,
      subscriptions,
      totalSubscriptionsCost,
      totalAllocatedPercentage,
      pageId,
      user
    });
  }, [amount, percentage, subscriptions, totalSubscriptionsCost, totalAllocatedPercentage, pageId, user]);

  const handleIncrement = () => {
    console.log('Increment clicked');
    setPercentage(prev => {
      const newValue = Math.min(prev + 10, 100);
      console.log('New percentage:', newValue);
      return newValue;
    });
    setAmount(prev => {
      const newValue = Math.min((prev + 1), 10);
      console.log('New amount:', newValue);
      return newValue;
    });
  };

  const handleDecrement = () => {
    console.log('Decrement clicked');
    setPercentage(prev => {
      const newValue = Math.max(prev - 10, 0);
      console.log('New percentage:', newValue);
      return newValue;
    });
    setAmount(prev => {
      const newValue = Math.max((prev - 1), 0);
      console.log('New amount:', newValue);
      return newValue;
    });
  };

  const handleSubscribe = async () => {
    console.log('Subscribe clicked with:', { amount, percentage });
    if (amount > 0) {
      try {
        await addSubscription(pageId, amount, percentage);
        // Redirect to success page after subscription
        window.location.href = '/test/subscription/success';
      } catch (error) {
        console.error('Error in handleSubscribe:', error);
        setError(error.message);
      }
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        if (totalSubscriptionsCost) {
          const currentSubscription = subscriptions.find(sub => sub.id === pageId);
          if (currentSubscription) {
            setAmount(currentSubscription.amount);
            setPercentage(currentSubscription.percentage);
          } else {
            setAmount(0);
            setPercentage(0);
          }
        }
        setError(null);
      } catch (err) {
        console.error('Error loading subscription data:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [subscriptions, totalSubscriptionsCost, pageId]);

  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorDisplay error={error} onRetry={() => window.location.reload()} />;

  return (
    <div className="w-full max-w-md bg-white rounded-lg shadow p-4 mb-4">
      <h3 className="text-lg font-semibold mb-2">Pledge</h3>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={handleDecrement}
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          aria-label="Decrease allocation"
        >
          -
        </button>
        <div className="flex-1 mx-4 h-6 bg-gray-200 rounded-full relative overflow-hidden">
          {/* Gray area for other allocations */}
          <div
            className={styles['bg-gray-bar']}
            style={{
              width: `${totalAllocatedPercentage}%`,
              position: 'absolute',
              height: '100%'
            }}
          />
          {/* Blue bar with striped pattern */}
          <div
            className={`${styles['bg-rectangle']} ${styles['active-bar']}`}
            style={{
              width: `${percentage}%`,
              position: 'absolute',
              height: '100%',
              borderRadius: percentage === 100 ? '9999px' : '9999px 0 0 9999px'
            }}
          />
        </div>
        <button
          onClick={handleIncrement}
          className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
          aria-label="Increase allocation"
        >
          +
        </button>
      </div>
      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-600">
          ${amount.toFixed(2)}/ $10
        </span>
        <button
          onClick={handleSubscribe}
          disabled={amount === 0}
          className={`px-4 py-2 rounded ${
            amount === 0
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          Subscribe
        </button>
      </div>
      {error && (
        <div className="mt-2 text-red-500 text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default PledgeBar;
