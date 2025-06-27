'use client';

import React from 'react';
import { InformationCircleIcon } from '@heroicons/react/24/outline';

interface PayoutFeeBreakdownProps {
  grossAmount: number;
  className?: string;
  showTooltip?: boolean;
}

interface FeeCalculation {
  grossAmount: number;
  stripeFee: number;
  stripeFeeFixed: number;
  platformFee: number;
  netAmount: number;
  totalFees: number;
}

export default function PayoutFeeBreakdown({ 
  grossAmount, 
  className = '',
  showTooltip = true 
}: PayoutFeeBreakdownProps) {
  
  const calculateFees = (amount: number): FeeCalculation => {
    // Fee configuration (should match backend)
    const stripeFeePercentage = 2.9; // 2.9%
    const stripeFeeFixed = 0.30; // $0.30
    const platformFeePercentage = 7; // 7%

    const stripeFee = (amount * stripeFeePercentage) / 100;
    const platformFee = (amount * platformFeePercentage) / 100;
    const totalFees = stripeFee + stripeFeeFixed + platformFee;
    const netAmount = amount - totalFees;

    return {
      grossAmount: amount,
      stripeFee,
      stripeFeeFixed,
      platformFee,
      netAmount: Math.max(0, netAmount), // Ensure non-negative
      totalFees
    };
  };

  const fees = calculateFees(grossAmount);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentage = (percentage: number): string => {
    return `${percentage}%`;
  };

  return (
    <div className={`bg-gray-50 border border-gray-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-center space-x-2 mb-3">
        <h3 className="font-semibold text-gray-900">Payout Breakdown</h3>
        {showTooltip && (
          <div className="relative group">
            <InformationCircleIcon className="w-4 h-4 text-gray-400 cursor-help" />
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
              <div className="text-center">
                <div>Fees are deducted from your earnings</div>
                <div>to cover payment processing costs</div>
              </div>
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {/* Gross Amount */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Gross earnings</span>
          <span className="font-medium text-gray-900">{formatCurrency(fees.grossAmount)}</span>
        </div>

        {/* Fees Section */}
        <div className="border-t border-gray-200 pt-2">
          <div className="text-xs text-gray-500 mb-1">Fees deducted:</div>
          
          {/* Stripe Processing Fee */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600 ml-2">
              Stripe processing ({formatPercentage(2.9)} + {formatCurrency(fees.stripeFeeFixed)})
            </span>
            <span className="text-red-600">-{formatCurrency(fees.stripeFee + fees.stripeFeeFixed)}</span>
          </div>

          {/* Platform Fee */}
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600 ml-2">
              Platform fee ({formatPercentage(7)})
            </span>
            <span className="text-red-600">-{formatCurrency(fees.platformFee)}</span>
          </div>

          {/* Total Fees */}
          <div className="flex justify-between items-center text-sm font-medium border-t border-gray-100 pt-1 mt-1">
            <span className="text-gray-700">Total fees</span>
            <span className="text-red-600">-{formatCurrency(fees.totalFees)}</span>
          </div>
        </div>

        {/* Net Amount */}
        <div className="border-t border-gray-300 pt-2">
          <div className="flex justify-between items-center">
            <span className="font-semibold text-gray-900">You receive</span>
            <span className="font-bold text-green-600 text-lg">{formatCurrency(fees.netAmount)}</span>
          </div>
        </div>
      </div>

      {/* Fee Explanation */}
      <div className="mt-3 p-3 bg-blue-50 rounded border border-blue-100">
        <div className="text-xs text-blue-800">
          <div className="font-medium mb-1">Why these fees?</div>
          <ul className="space-y-1">
            <li>• <strong>Stripe processing:</strong> Payment processing and international transfers</li>
            <li>• <strong>Platform fee:</strong> Supports WeWrite's operations and development</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

// Compact version for inline display
export function CompactFeeBreakdown({ 
  grossAmount, 
  className = '' 
}: { 
  grossAmount: number; 
  className?: string; 
}) {
  const calculateNetAmount = (amount: number): number => {
    const stripeFee = (amount * 2.9) / 100 + 0.30;
    const platformFee = (amount * 7) / 100;
    return Math.max(0, amount - stripeFee - platformFee);
  };

  const netAmount = calculateNetAmount(grossAmount);
  const totalFees = grossAmount - netAmount;
  const feePercentage = grossAmount > 0 ? (totalFees / grossAmount) * 100 : 0;

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className={`inline-flex items-center space-x-2 text-sm ${className}`}>
      <span className="text-gray-600">
        {formatCurrency(grossAmount)} → 
      </span>
      <span className="font-medium text-green-600">
        {formatCurrency(netAmount)}
      </span>
      <span className="text-xs text-gray-500">
        ({feePercentage.toFixed(1)}% fees)
      </span>
    </div>
  );
}

// Summary version for payout requests
export function PayoutSummary({ 
  grossAmount, 
  className = '' 
}: { 
  grossAmount: number; 
  className?: string; 
}) {
  const calculateNetAmount = (amount: number): number => {
    const stripeFee = (amount * 2.9) / 100 + 0.30;
    const platformFee = (amount * 7) / 100;
    return Math.max(0, amount - stripeFee - platformFee);
  };

  const netAmount = calculateNetAmount(grossAmount);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  return (
    <div className={`bg-green-50 border border-green-200 rounded-lg p-3 ${className}`}>
      <div className="text-center">
        <div className="text-sm text-green-700 mb-1">You will receive</div>
        <div className="text-2xl font-bold text-green-800">{formatCurrency(netAmount)}</div>
        <div className="text-xs text-green-600 mt-1">
          After fees on {formatCurrency(grossAmount)} earnings
        </div>
      </div>
    </div>
  );
}
