'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getNextMonthlyProcessingDate } from '../utils/subscriptionTiers';

interface StartOfMonthExplainerProps {
  className?: string;
  variant?: 'full' | 'compact' | 'minimal';
}

export default function StartOfMonthExplainer({ 
  className = '', 
  variant = 'full' 
}: StartOfMonthExplainerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const nextProcessingDate = getNextMonthlyProcessingDate();

  if (variant === 'minimal') {
    return (
      <div className={`text-sm text-gray-600 ${className}`}>
        <p>
          <strong>Start-of-Month Processing:</strong> All monthly operations happen on the 1st. 
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-600 hover:text-blue-800 ml-1"
          >
            Learn more
          </button>
        </p>
        {isExpanded && (
          <div className="mt-2 p-3 bg-gray-50 rounded border-theme-strong text-xs">
            <ul className="space-y-1">
              <li>• Your allocations are finalized and sent to writers</li>
              <li>• Writers can request payouts</li>
              <li>• Your subscription renews with new tokens</li>
              <li>• You can start allocating new tokens immediately</li>
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={`bg-blue-50 border-theme-strong rounded-lg p-3 ${className}`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-blue-800 text-sm">Start-of-Month Processing</h3>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-blue-600 hover:text-blue-800"
          >
            {isExpanded ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
        </div>
        
        <p className="text-blue-700 text-sm mt-1">
          All monthly operations happen on the 1st at 9 AM UTC
        </p>

        {isExpanded && (
          <div className="mt-3 space-y-2">
            <div className="grid grid-cols-1 gap-2 text-xs">
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-800 font-bold">1</div>
                <span>Finalize allocations → send to writers</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-800 font-bold">2</div>
                <span>Process payouts for writers</span>
              </div>
              <div className="flex items-center space-x-2">
                <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-800 font-bold">3</div>
                <span>Renew subscriptions → new tokens available</span>
              </div>
            </div>
            <div className="text-xs text-blue-600 mt-2">
              <strong>Next processing:</strong> {nextProcessingDate.toLocaleDateString()} at {nextProcessingDate.toLocaleTimeString()}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Full variant
  return (
    <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 border-theme-strong rounded-lg p-6 ${className}`}>
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
          <span className="text-blue-800 font-bold text-lg">1</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-blue-900">Start-of-Month Processing</h2>
          <p className="text-blue-700">Simple, predictable monthly operations</p>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg p-4 border border-blue-100">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-800 font-bold">1</span>
            </div>
            <h3 className="font-semibold text-gray-900">Finalize Allocations</h3>
          </div>
          <p className="text-sm text-gray-600">
            Your token allocations from the previous month are finalized and sent to writers.
          </p>
        </div>

        <div className="bg-white rounded-lg p-4 border border-blue-100">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <span className="text-yellow-800 font-bold">2</span>
            </div>
            <h3 className="font-semibold text-gray-900">Process Payouts</h3>
          </div>
          <p className="text-sm text-gray-600">
            Writers can request payouts of their earnings from the previous month.
          </p>
        </div>

        <div className="bg-white rounded-lg p-4 border border-blue-100">
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-800 font-bold">3</span>
            </div>
            <h3 className="font-semibold text-gray-900">Renew Subscriptions</h3>
          </div>
          <p className="text-sm text-gray-600">
            Your subscription renews and you immediately get new tokens to allocate.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg p-4 border border-blue-100">
        <h3 className="font-semibold text-gray-900 mb-2">Why Start-of-Month?</h3>
        <ul className="text-sm text-gray-600 space-y-1">
          <li className="flex items-start space-x-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span><strong>No dead zones:</strong> You can allocate tokens immediately after renewal</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span><strong>Predictable timing:</strong> Everything happens on the same day each month</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span><strong>Flexible adjustments:</strong> Change allocations throughout the month</span>
          </li>
          <li className="flex items-start space-x-2">
            <span className="text-green-500 mt-0.5">✓</span>
            <span><strong>Clean accounting:</strong> Clear monthly cycles for all users</span>
          </li>
        </ul>
      </div>

      <div className="mt-4 p-3 bg-blue-100 rounded-lg">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-blue-800">Next processing date:</span>
          <span className="font-mono text-blue-900">
            {nextProcessingDate.toLocaleDateString()} at {nextProcessingDate.toLocaleTimeString()} UTC
          </span>
        </div>
      </div>
    </div>
  );
}