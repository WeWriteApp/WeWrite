"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Icon } from '@/components/ui/Icon';
import { calculateTokensForAmount } from '../../utils/subscriptionTiers';

interface PricingDisplayProps {
  /** Base subscription amount */
  amount: number;
  /** Plan name */
  planName: string;
  /** Whether this is a custom amount */
  isCustom?: boolean;
  /** Show detailed breakdown */
  showBreakdown?: boolean;
  /** Tax rate (as decimal, e.g., 0.08 for 8%) */
  taxRate?: number;
  /** Currency code */
  currency?: string;
  /** Additional fees */
  processingFee?: number;
  /** Customer location for tax calculation */
  customerLocation?: {
    country: string;
    state?: string;
    postalCode?: string;
  };
  /** Loading state for tax calculation */
  isCalculatingTax?: boolean;
}

interface PricingBreakdown {
  subtotal: number;
  tax: number;
  processingFee: number;
  total: number;
  tokens: number;
}

/**
 * PricingDisplay - Comprehensive pricing breakdown component
 * 
 * Features:
 * - Real-time tax calculations
 * - Processing fee display
 * - Token allocation preview
 * - Clear pricing breakdown
 * - Support for custom amounts
 */
export function PricingDisplay({
  amount,
  planName,
  isCustom = false,
  showBreakdown = true,
  taxRate = 0,
  currency = 'USD',
  processingFee = 0,
  customerLocation,
  isCalculatingTax = false
}: PricingDisplayProps) {
  const [breakdown, setBreakdown] = useState<PricingBreakdown | null>(null);
  const [calculatedTaxRate, setCalculatedTaxRate] = useState(taxRate);

  // Calculate tax rate based on customer location
  useEffect(() => {
    if (customerLocation && customerLocation.country === 'US') {
      // Simple US state tax rates (in a real app, use a tax service like TaxJar)
      const stateTaxRates: Record<string, number> = {
        'CA': 0.0725, // California
        'NY': 0.08,   // New York
        'TX': 0.0625, // Texas
        'FL': 0.06,   // Florida
        'WA': 0.065,  // Washington
        'OR': 0.0,    // Oregon (no sales tax)
        'NH': 0.0,    // New Hampshire (no sales tax)
        'MT': 0.0,    // Montana (no sales tax)
        'DE': 0.0,    // Delaware (no sales tax)
        'AK': 0.0,    // Alaska (no state sales tax)
      };

      const stateRate = customerLocation.state ? stateTaxRates[customerLocation.state] || 0.06 : 0.06;
      setCalculatedTaxRate(stateRate);
    } else if (customerLocation && customerLocation.country === 'CA') {
      // Canada GST/HST rates
      setCalculatedTaxRate(0.05); // 5% GST minimum
    } else if (customerLocation && ['GB', 'DE', 'FR', 'IT', 'ES', 'NL'].includes(customerLocation.country)) {
      // EU VAT rates (simplified)
      setCalculatedTaxRate(0.20); // 20% average VAT
    } else {
      setCalculatedTaxRate(taxRate);
    }
  }, [customerLocation, taxRate]);

  // Calculate pricing breakdown
  useEffect(() => {
    const subtotal = amount;
    const tax = subtotal * calculatedTaxRate;
    const total = subtotal + tax + processingFee;
    const tokens = calculateTokensForAmount(amount);

    setBreakdown({
      subtotal,
      tax,
      processingFee,
      total,
      tokens
    });
  }, [amount, calculatedTaxRate, processingFee]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2
    }).format(value);
  };

  if (!breakdown) {
    return null;
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Order Summary</CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Plan and Amount */}
        <div className="flex justify-between items-center">
          <div>
            <p className="font-medium">{planName}</p>
            {isCustom && <Badge variant="secondary" className="mt-1">Custom Amount</Badge>}
          </div>
          <div className="text-right">
            <div className="text-xl font-bold">{formatCurrency(breakdown.total)}</div>
            <div className="text-sm text-muted-foreground">per month</div>
          </div>
        </div>

        <Separator />

        {/* Token Allocation */}
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Icon name="Zap" size={16} className="text-primary" />
            <span className="font-medium">Monthly Tokens</span>
          </div>
          <div className="text-lg font-semibold">{breakdown.tokens}</div>
        </div>

        {/* Tax if applicable */}
        {(breakdown.tax > 0 || isCalculatingTax) && (
          <>
            <Separator />
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(breakdown.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="flex items-center gap-2">
                  Tax {!isCalculatingTax && `(${(calculatedTaxRate * 100).toFixed(1)}%)`}
                  {isCalculatingTax && (
                    <Icon name="Loader" size={12} />
                  )}
                </span>
                <span>
                  {isCalculatingTax ? 'Calculating...' : formatCurrency(breakdown.tax)}
                </span>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
