'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Separator } from '../ui/separator';
import { 
  Loader, 
  Save, 
  AlertCircle, 
  CheckCircle2, 
  DollarSign, 
  CreditCard,
  Settings,
  Calculator,
  Info
} from 'lucide-react';
import { 
  FeeConfigurationService, 
  ComprehensiveFeeStructure,
  DEFAULT_FEE_STRUCTURE 
} from '../../services/feeConfigurationService';

export default function ComprehensiveFeeManagement() {
  const [feeStructure, setFeeStructure] = useState<ComprehensiveFeeStructure>(DEFAULT_FEE_STRUCTURE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [originalStructure, setOriginalStructure] = useState<ComprehensiveFeeStructure>(DEFAULT_FEE_STRUCTURE);

  // Calculator state
  const [calculatorAmount, setCalculatorAmount] = useState<number>(100);
  const [calculatorMethod, setCalculatorMethod] = useState<'standard' | 'instant'>('standard');
  const [calculatorResult, setCalculatorResult] = useState<any>(null);

  // Subscribe to real-time fee structure changes
  useEffect(() => {
    setIsLoading(true);

    const unsubscribe = FeeConfigurationService.subscribeFeeChanges((structure) => {
      setFeeStructure(structure);
      setOriginalStructure(structure);
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setMessage(null);

      // Validate inputs
      const validationErrors = validateFeeStructure(feeStructure);
      if (validationErrors.length > 0) {
        setMessage({ type: 'error', text: validationErrors.join(', ') });
        return;
      }

      // Save using fee service
      await FeeConfigurationService.updateFeeStructure(feeStructure, 'admin');
      
      setOriginalStructure(feeStructure);
      setMessage({ 
        type: 'success', 
        text: 'Fee structure updated successfully. Changes will apply to all future payouts.' 
      });

      // Clear message after 5 seconds
      setTimeout(() => setMessage(null), 5000);

    } catch (error) {
      console.error('Error saving fee structure:', error);
      setMessage({ type: 'error', text: 'Failed to save fee structure. Please try again.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setFeeStructure(originalStructure);
    setMessage(null);
  };

  const handleCalculate = async () => {
    try {
      const result = await FeeConfigurationService.calculatePayoutFees(calculatorAmount, calculatorMethod);
      setCalculatorResult(result);
    } catch (error) {
      console.error('Error calculating fees:', error);
    }
  };

  const validateFeeStructure = (structure: ComprehensiveFeeStructure): string[] => {
    const errors: string[] = [];
    
    if (structure.platformFeePercentage < 0 || structure.platformFeePercentage > 1) {
      errors.push('Platform fee must be between 0% and 100%');
    }
    if (structure.stripeConnectFeePercentage < 0 || structure.stripeConnectFeePercentage > 0.1) {
      errors.push('Stripe Connect fee must be between 0% and 10%');
    }
    if (structure.minimumPayoutThreshold < 1 || structure.minimumPayoutThreshold > 1000) {
      errors.push('Minimum payout threshold must be between $1 and $1000');
    }
    if (structure.tokensPerDollar < 1 || structure.tokensPerDollar > 1000) {
      errors.push('Tokens per dollar must be between 1 and 1000');
    }
    
    return errors;
  };

  const hasChanges = JSON.stringify(feeStructure) !== JSON.stringify(originalStructure);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="h-6 w-6 animate-spin mr-2" />
        <span>Loading fee configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Status Message */}
      {message && (
        <Alert className={message.type === 'error' ? 'border-red-500' : message.type === 'success' ? 'border-green-500' : 'border-border'}>
          {message.type === 'error' ? (
            <AlertCircle className="h-4 w-4" />
          ) : message.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <Info className="h-4 w-4" />
          )}
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="platform" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="platform">
            <DollarSign className="h-4 w-4 mr-2" />
            Platform Fees
          </TabsTrigger>
          <TabsTrigger value="stripe">
            <CreditCard className="h-4 w-4 mr-2" />
            Stripe Fees
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </TabsTrigger>
          <TabsTrigger value="calculator">
            <Calculator className="h-4 w-4 mr-2" />
            Calculator
          </TabsTrigger>
        </TabsList>

        {/* Platform Fees Tab */}
        <TabsContent value="platform" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>WeWrite Platform Fee</CardTitle>
              <CardDescription>
                The percentage WeWrite takes from creator payouts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="platformFee">Platform Fee Percentage</Label>
                  <div className="flex items-center space-x-2">
                    <Input
                      id="platformFee"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={(feeStructure.platformFeePercentage * 100).toFixed(1)}
                      onChange={(e) => setFeeStructure({
                        ...feeStructure,
                        platformFeePercentage: parseFloat(e.target.value) / 100 || 0
                      })}
                      className="w-32"
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>
                <div className="flex flex-col justify-center">
                  <div className="text-2xl font-bold text-primary">
                    {(feeStructure.platformFeePercentage * 100).toFixed(1)}%
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Creators keep {(100 - feeStructure.platformFeePercentage * 100).toFixed(1)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stripe Fees Tab */}
        <TabsContent value="stripe" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Stripe Processing Fees</CardTitle>
              <CardDescription>
                Fees charged by Stripe for payment processing and payouts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="stripeConnectFee">Stripe Connect Fee (%)</Label>
                  <Input
                    id="stripeConnectFee"
                    type="number"
                    min="0"
                    max="10"
                    step="0.001"
                    value={(feeStructure.stripeConnectFeePercentage * 100).toFixed(3)}
                    onChange={(e) => setFeeStructure({
                      ...feeStructure,
                      stripeConnectFeePercentage: parseFloat(e.target.value) / 100 || 0
                    })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Default: 0.25% for Express accounts
                  </p>
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="instantPayoutPercent">Instant Payout Fee (%)</Label>
                    <Input
                      id="instantPayoutPercent"
                      type="number"
                      min="0"
                      max="10"
                      step="0.1"
                      value={(feeStructure.stripeInstantPayoutPercentage * 100).toFixed(1)}
                      onChange={(e) => setFeeStructure({
                        ...feeStructure,
                        stripeInstantPayoutPercentage: parseFloat(e.target.value) / 100 || 0
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="instantPayoutFixed">Instant Payout Fixed Fee ($)</Label>
                    <Input
                      id="instantPayoutFixed"
                      type="number"
                      min="0"
                      max="10"
                      step="0.01"
                      value={feeStructure.stripeInstantPayoutFixed.toFixed(2)}
                      onChange={(e) => setFeeStructure({
                        ...feeStructure,
                        stripeInstantPayoutFixed: parseFloat(e.target.value) || 0
                      })}
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="standardPayoutFee">Standard Payout Fee ($)</Label>
                  <Input
                    id="standardPayoutFee"
                    type="number"
                    min="0"
                    max="10"
                    step="0.01"
                    value={feeStructure.stripeStandardPayoutFee.toFixed(2)}
                    onChange={(e) => setFeeStructure({
                      ...feeStructure,
                      stripeStandardPayoutFee: parseFloat(e.target.value) || 0
                    })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Standard payouts (2-5 business days) are typically free
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Settings</CardTitle>
              <CardDescription>
                Core platform configuration settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="minThreshold">Minimum Payout Threshold ($)</Label>
                  <Input
                    id="minThreshold"
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    value={feeStructure.minimumPayoutThreshold.toFixed(0)}
                    onChange={(e) => setFeeStructure({
                      ...feeStructure,
                      minimumPayoutThreshold: parseFloat(e.target.value) || 25
                    })}
                  />
                </div>
                <div>
                  <Label htmlFor="tokensPerDollar">Tokens per Dollar</Label>
                  <Input
                    id="tokensPerDollar"
                    type="number"
                    min="1"
                    max="1000"
                    step="1"
                    value={feeStructure.tokensPerDollar.toString()}
                    onChange={(e) => setFeeStructure({
                      ...feeStructure,
                      tokensPerDollar: parseInt(e.target.value) || 10
                    })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Current: {feeStructure.tokensPerDollar} tokens = $1 USD
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Calculator Tab */}
        <TabsContent value="calculator" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fee Calculator</CardTitle>
              <CardDescription>
                Calculate fees for different payout amounts and methods
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="calcAmount">Payout Amount ($)</Label>
                  <Input
                    id="calcAmount"
                    type="number"
                    min="1"
                    step="0.01"
                    value={calculatorAmount}
                    onChange={(e) => setCalculatorAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div>
                  <Label htmlFor="calcMethod">Payout Method</Label>
                  <select
                    id="calcMethod"
                    value={calculatorMethod}
                    onChange={(e) => setCalculatorMethod(e.target.value as 'standard' | 'instant')}
                    className="wewrite-input"
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="standard">Standard (2-5 days)</option>
                    <option value="instant">Instant</option>
                  </select>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleCalculate} className="w-full">
                    Calculate
                  </Button>
                </div>
              </div>

              {calculatorResult && (
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <h4 className="font-semibold mb-2">Fee Breakdown:</h4>
                  <div className="space-y-1 text-sm">
                    {calculatorResult.breakdown.map((line: string, index: number) => (
                      <div key={index} className={index === calculatorResult.breakdown.length - 1 ? 'font-semibold text-primary' : ''}>
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Action Buttons */}
      <div className="flex justify-between items-center pt-4 border-t">
        <div className="text-sm text-muted-foreground">
          Last updated: {new Date(originalStructure.lastUpdated).toLocaleString()} by {originalStructure.updatedBy}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={handleReset}
            disabled={!hasChanges || isSaving}
          >
            Reset
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
          >
            {isSaving ? (
              <>
                <Loader className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
