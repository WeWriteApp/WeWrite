'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription } from '../ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Loader, Save, AlertCircle, CheckCircle2, DollarSign } from 'lucide-react';
import { subscribeFeeChanges, updateFeeStructure } from '../../services/feeService';
import type { FeeStructure } from '../../services/feeService';

export default function FeeManagementSection() {
  const [feePercentage, setFeePercentage] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [originalFee, setOriginalFee] = useState<number>(0);

  // Subscribe to real-time fee structure changes
  useEffect(() => {
    setIsLoading(true);

    const unsubscribe = subscribeFeeChanges((feeStructure) => {
      const percentage = feeStructure.platformFeePercentage * 100; // Convert to percentage
      setFeePercentage(percentage);
      setOriginalFee(percentage);
      setIsLoading(false);
    });

    // Cleanup subscription on unmount
    return unsubscribe;
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setMessage(null);

      // Validate input
      if (feePercentage < 0 || feePercentage > 100) {
        setMessage({ type: 'error', text: 'Fee percentage must be between 0% and 100%' });
        return;
      }

      // Save using fee service
      await updateFeeStructure(feePercentage, 'admin');
      
      setOriginalFee(feePercentage);
      setMessage({ 
        type: 'success', 
        text: `WeWrite fee updated to ${feePercentage}%. This will apply to all future payouts.` 
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
    setFeePercentage(originalFee);
    setMessage(null);
  };

  const hasChanges = feePercentage !== originalFee;

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
      {/* Current Fee Display */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <DollarSign className="h-5 w-5 mr-2" />
            Current Platform Fee
          </CardTitle>
          <CardDescription>
            The percentage WeWrite takes from creator payouts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-primary">
            {originalFee}%
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Creators keep {100 - originalFee}% of their earnings (minus payment processing fees)
          </p>
        </CardContent>
      </Card>

      {/* Fee Configuration */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="feePercentage">Platform Fee Percentage</Label>
          <div className="flex items-center space-x-2">
            <Input
              id="feePercentage"
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={feePercentage}
              onChange={(e) => setFeePercentage(parseFloat(e.target.value) || 0)}
              className="w-32"
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Enter a value between 0% and 100%. This fee will be deducted from creator payouts.
          </p>
        </div>

        {/* Preview */}
        <Card className="bg-muted/50">
          <CardContent className="pt-4">
            <h4 className="font-medium mb-2">Payout Preview</h4>
            <div className="text-sm space-y-1">
              <div className="flex justify-between">
                <span>Creator earnings:</span>
                <span>$100.00</span>
              </div>
              <div className="flex justify-between">
                <span>WeWrite fee ({feePercentage}%):</span>
                <span>-${(100 * feePercentage / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium border-t pt-1">
                <span>Creator receives:</span>
                <span>${(100 * (100 - feePercentage) / 100).toFixed(2)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex space-x-2">
          <Button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            variant="success"
            className="flex-1"
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
          
          {hasChanges && (
            <Button
              variant="secondary"
              onClick={handleReset}
              disabled={isSaving}
            >
              Reset
            </Button>
          )}
        </div>

        {/* Status Messages */}
        {message && (
          <Alert className={message.type === 'error' ? 'border-destructive' : message.type === 'success' ? 'border-green-500' : ''}>
            {message.type === 'error' ? (
              <AlertCircle className="h-4 w-4" />
            ) : message.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {/* Warning */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important:</strong> Fee changes will only apply to future payouts. Existing pending payouts will use the fee rate that was active when they were initiated.
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}