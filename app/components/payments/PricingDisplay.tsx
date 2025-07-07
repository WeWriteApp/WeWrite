"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Separator } from '../ui/separator';
import { Info, Zap, CreditCard } from 'lucide-react';
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
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {planName}
            {isCustom && <Badge variant="secondary" className="ml-2">Custom</Badge>}
          </CardTitle>
          <div className="text-right">
            <div className="text-2xl font-bold">{formatCurrency(breakdown.total)}</div>
            <div className="text-sm text-muted-foreground">per month</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Token Allocation Preview */}
        <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-lg border">
          <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-full">
            <Zap className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium">Monthly Token Allocation</p>
            <p className="text-sm text-muted-foreground">
              {breakdown.tokens} tokens to support creators
            </p>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold">{breakdown.tokens}</div>
            <div className="text-xs text-muted-foreground">tokens</div>
          </div>
        </div>

        {/* Pricing Breakdown */}
        {showBreakdown && (
          <div className="space-y-3">
            <Separator />
            
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Subscription</span>
                <span>{formatCurrency(breakdown.subtotal)}</span>
              </div>
              
              {(breakdown.tax > 0 || isCalculatingTax) && (
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    Tax {!isCalculatingTax && `(${(calculatedTaxRate * 100).toFixed(1)}%)`}
                    {isCalculatingTax && (
                      <div className="w-3 h-3 border border-muted-foreground border-t-transparent rounded-full animate-spin" />
                    )}
                  </span>
                  <span>
                    {isCalculatingTax ? 'Calculating...' : formatCurrency(breakdown.tax)}
                  </span>
                </div>
              )}
              
              {breakdown.processingFee > 0 && (
                <div className="flex justify-between text-sm">
                  <span>Processing Fee</span>
                  <span>{formatCurrency(breakdown.processingFee)}</span>
                </div>
              )}
              
              <Separator />
              
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>{formatCurrency(breakdown.total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Payment Security Notice */}
        <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
          <CreditCard className="w-4 h-4 text-muted-foreground mt-0.5" />
          <div className="text-xs text-muted-foreground">
            <p className="font-medium mb-1">Secure Payment</p>
            <p>
              Your payment information is encrypted and processed securely by Stripe. 
              We never store your card details.
            </p>
          </div>
        </div>

        {/* Token Economy Info */}
        <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5" />
          <div className="text-xs text-blue-700 dark:text-blue-300">
            <p className="font-medium mb-1">How Tokens Work</p>
            <p>
              Each month, you'll receive {breakdown.tokens} tokens to allocate to your favorite creators. 
              Unallocated tokens automatically support WeWrite platform development.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
