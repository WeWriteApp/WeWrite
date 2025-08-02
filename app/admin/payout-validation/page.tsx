"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import { Separator } from '../../components/ui/separator';
import { 
  Calculator, 
  DollarSign, 
  TrendingDown,
  CheckCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
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
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Calculator className="h-8 w-8" />
            Payout Validation Tool
          </h1>
          <p className="text-muted-foreground">
            Validate USD-to-payout calculations and fee structures
          </p>
        </div>
      </div>

      {/* Current Fee Structure */}
      {feeStructure && (
        <Card>
          <CardHeader>
            <CardTitle>Current Fee Structure</CardTitle>
            <CardDescription>
              Active fee configuration for payouts (Stripe fees are automatically handled)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {formatPercentage(feeStructure.platformFeePercentage)}
                </div>
                <div className="text-sm text-muted-foreground">WeWrite Platform Fee</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  {formatPercentage(feeStructure.stripeConnectFeePercentage)}
                </div>
                <div className="text-sm text-muted-foreground">Stripe Connect Fee (Auto)</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {formatCurrency(feeStructure.minimumPayoutThreshold)}
                </div>
                <div className="text-sm text-muted-foreground">Minimum Threshold</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Input Section */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Calculation</CardTitle>
          <CardDescription>
            Enter USD cents amount to validate payout calculation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="usdCents">USD Cents Earned</Label>
              <Input
                id="usdCents"
                type="number"
                min="0"
                step="1"
                value={usdCentsEarned}
                onChange={(e) => setUsdCentsEarned(parseInt(e.target.value) || 0)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                100 cents = $1 USD
              </p>
            </div>
            <div>
              <Label htmlFor="method">Payout Method</Label>
              <select
                id="method"
                value={payoutMethod}
                onChange={(e) => setPayoutMethod(e.target.value as 'standard' | 'instant')}
                className="mt-1 w-full px-3 py-2 border border-input bg-background rounded-md"
              >
                <option value="standard">Standard (2-5 days, free)</option>
                <option value="instant">Instant (1.5% + $0.50)</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button onClick={validatePayout} disabled={isLoading} className="w-full">
                {isLoading ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Calculator className="h-4 w-4 mr-2" />
                )}
                Calculate Payout
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Validation Results */}
      {validation && (
        <div className="space-y-4">
          {/* Status Alert */}
          <Alert variant={validation.isValid ? "default" : "destructive"}>
            {validation.isValid ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertTitle>
              {validation.isValid ? 'Payout Validation Passed' : 'Payout Validation Failed'}
            </AlertTitle>
            <AlertDescription>
              {validation.isValid 
                ? 'All calculations are correct and within acceptable parameters.'
                : `${validation.errors.length} issue(s) found with the payout calculation.`
              }
            </AlertDescription>
          </Alert>

          {/* Error Details */}
          {validation.errors.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Validation Errors</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="list-disc list-inside space-y-1">
                  {validation.errors.map((error, index) => (
                    <li key={index} className="text-red-600 text-sm">{error}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Fee Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Fee Breakdown</CardTitle>
              <CardDescription>
                Detailed calculation of all fees and net payout amount
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-800">
                      {formatCurrency(validation.grossAmount)}
                    </div>
                    <div className="text-sm text-green-600">Gross Amount</div>
                    <div className="text-xs text-muted-foreground">
                      {validation.usdCentsEarned} USD cents
                    </div>
                  </div>
                  <div className="text-center p-4 bg-red-50 rounded-lg">
                    <div className="text-2xl font-bold text-red-800">
                      {formatCurrency(validation.totalFees)}
                    </div>
                    <div className="text-sm text-red-600">Total Fees</div>
                    <div className="text-xs text-muted-foreground">
                      {((validation.totalFees / validation.grossAmount) * 100).toFixed(1)}% of gross
                    </div>
                  </div>
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-800">
                      {formatCurrency(validation.netAmount)}
                    </div>
                    <div className="text-sm text-blue-600">Net Payout</div>
                    <div className="text-xs text-muted-foreground">
                      Amount you receive
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Detailed Breakdown */}
                <div className="space-y-2">
                  <h4 className="font-medium">Detailed Fee Breakdown:</h4>
                  {validation.breakdown.map((line, index) => (
                    <div key={index} className="text-sm font-mono bg-muted p-2 rounded">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
