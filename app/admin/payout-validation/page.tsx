"use client";

import React, { useState, useEffect } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Separator } from '../../components/ui/separator';
import { FeeConfigurationService } from '../../services/feeConfigurationService';

interface PayoutValidation {
  usdCentsEarned: number;
  grossAmount: number;
  platformFee: number;
  stripeConnectFee: number;
  stripePayoutFee: number;
  totalFees: number;
  netAmount: number;
  breakdown: string[];
  isValid: boolean;
  errors: string[];
}

export default function PayoutValidationPage() {
  const [usdCentsEarned, setUsdCentsEarned] = useState<number>(1000);
  const [payoutMethod, setPayoutMethod] = useState<'standard' | 'instant'>('standard');
  const [validation, setValidation] = useState<PayoutValidation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [feeStructure, setFeeStructure] = useState<any>(null);

  // Load current fee structure
  useEffect(() => {
    const loadFeeStructure = async () => {
      try {
        const structure = await FeeConfigurationService.getCurrentFeeStructure();
        setFeeStructure(structure);
      } catch (error) {
        console.error('Error loading fee structure:', error);
      }
    };
    loadFeeStructure();
  }, []);

  const validatePayout = async () => {
    setIsLoading(true);
    try {
      // Convert USD cents to USD dollars (100 cents = $1)
      const grossAmount = usdCentsEarned / 100;
      
      // Calculate fees using the centralized service
      const feeCalculation = await FeeConfigurationService.calculatePayoutFees(grossAmount, payoutMethod);
      
      // Validation checks
      const errors: string[] = [];
      
      // Check minimum threshold
      if (grossAmount < 25) {
        errors.push(`Amount $${grossAmount.toFixed(2)} is below minimum threshold of $25.00`);
      }
      
      // Check if net amount is positive
      if (feeCalculation.netAmount <= 0) {
        errors.push('Net payout amount is zero or negative after fees');
      }
      
      // Check fee percentages are reasonable
      const totalFeePercentage = (feeCalculation.totalFees / grossAmount) * 100;
      if (totalFeePercentage > 50) {
        errors.push(`Total fees (${totalFeePercentage.toFixed(1)}%) exceed 50% of gross amount`);
      }
      
      const validation: PayoutValidation = {
        usdCentsEarned,
        grossAmount,
        platformFee: feeCalculation.platformFee,
        stripeConnectFee: feeCalculation.stripeConnectFee,
        stripePayoutFee: feeCalculation.stripePayoutFee,
        totalFees: feeCalculation.totalFees,
        netAmount: feeCalculation.netAmount,
        breakdown: feeCalculation.breakdown,
        isValid: errors.length === 0,
        errors
      };
      
      setValidation(validation);
    } catch (error) {
      console.error('Error validating payout:', error);
      setValidation({
        usdCentsEarned,
        grossAmount: 0,
        platformFee: 0,
        stripeConnectFee: 0,
        stripePayoutFee: 0,
        totalFees: 0,
        netAmount: 0,
        breakdown: [],
        isValid: false,
        errors: ['Failed to calculate payout fees']
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatPercentage = (decimal: number): string => {
    return `${(decimal * 100).toFixed(2)}%`;
  };

  return (
    <div className="space-y-4">
      {/* Current Fee Structure */}
      {feeStructure && (
        <div className="wewrite-card">
          <h2 className="font-semibold text-sm mb-3">Fee Structure</h2>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-lg font-bold text-red-600">
                {formatPercentage(feeStructure.platformFeePercentage)}
              </div>
              <div className="text-xs text-muted-foreground">Platform</div>
            </div>
            <div>
              <div className="text-lg font-bold text-orange-600">
                {formatPercentage(feeStructure.stripeConnectFeePercentage)}
              </div>
              <div className="text-xs text-muted-foreground">Stripe</div>
            </div>
            <div>
              <div className="text-lg font-bold text-primary">
                {formatCurrency(feeStructure.minimumPayoutThreshold)}
              </div>
              <div className="text-xs text-muted-foreground">Min</div>
            </div>
          </div>
        </div>
      )}

      {/* Input Section */}
      <div className="wewrite-card space-y-3">
        <h2 className="font-semibold text-sm">Calculate Payout</h2>

        <div>
          <Label htmlFor="usdCents" className="text-xs">USD Cents Earned</Label>
          <Input
            id="usdCents"
            type="number"
            min="0"
            step="1"
            value={usdCentsEarned}
            onChange={(e) => setUsdCentsEarned(parseInt(e.target.value) || 0)}
            className="mt-1"
          />
          <p className="text-xs text-muted-foreground mt-1">100 cents = $1</p>
        </div>

        <div>
          <Label htmlFor="method" className="text-xs">Payout Method</Label>
          <select
            id="method"
            value={payoutMethod}
            onChange={(e) => setPayoutMethod(e.target.value as 'standard' | 'instant')}
            className="mt-1 w-full px-3 py-2 border border-border bg-background rounded-md text-sm"
          >
            <option value="standard">Standard (2-5 days)</option>
            <option value="instant">Instant (1.5% + $0.50)</option>
          </select>
        </div>

        <Button onClick={validatePayout} disabled={isLoading} size="sm" className="w-full gap-1.5">
          {isLoading ? (
            <Icon name="RefreshCw" size={14} className="animate-spin" />
          ) : (
            <Icon name="Calculator" size={14} />
          )}
          Calculate
        </Button>
      </div>

      {/* Validation Results */}
      {validation && (
        <div className="space-y-3">
          {/* Status Alert */}
          <Alert variant={validation.isValid ? "default" : "destructive"}>
            {validation.isValid ? (
              <Icon name="CheckCircle" size={14} />
            ) : (
              <Icon name="AlertCircle" size={14} />
            )}
            <AlertTitle className="text-sm">
              {validation.isValid ? 'Valid' : 'Invalid'}
            </AlertTitle>
            <AlertDescription className="text-xs">
              {validation.isValid
                ? 'Calculations are correct.'
                : `${validation.errors.length} issue(s) found.`
              }
            </AlertDescription>
          </Alert>

          {/* Error Details */}
          {validation.errors.length > 0 && (
            <div className="wewrite-card">
              <h3 className="font-semibold text-sm text-red-600 mb-2">Errors</h3>
              <ul className="space-y-1">
                {validation.errors.map((error, index) => (
                  <li key={index} className="text-red-600 text-xs">• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Fee Breakdown */}
          <div className="wewrite-card space-y-3">
            <h3 className="font-semibold text-sm">Breakdown</h3>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-green-50 dark:bg-green-950/30 rounded">
                <div className="text-base font-bold text-green-700 dark:text-green-400">
                  {formatCurrency(validation.grossAmount)}
                </div>
                <div className="text-xs text-green-600 dark:text-green-500">Gross</div>
              </div>
              <div className="p-2 bg-red-50 dark:bg-red-950/30 rounded">
                <div className="text-base font-bold text-red-700 dark:text-red-400">
                  {formatCurrency(validation.totalFees)}
                </div>
                <div className="text-xs text-red-600 dark:text-red-500">Fees</div>
              </div>
              <div className="p-2 bg-muted rounded">
                <div className="text-base font-bold">
                  {formatCurrency(validation.netAmount)}
                </div>
                <div className="text-xs text-muted-foreground">Net</div>
              </div>
            </div>

            <Separator />

            {/* Detailed Breakdown */}
            <div className="space-y-1">
              {validation.breakdown.map((line, index) => (
                <div key={index} className="text-xs font-mono bg-muted p-1.5 rounded">
                  {line}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
