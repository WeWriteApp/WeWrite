'use client';

import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Loader2, AlertTriangle, CheckCircle, Building } from 'lucide-react';

interface AddBankAccountFormProps {
  onSuccess: (bankAccount: any) => void;
  onCancel: () => void;
}

export function AddBankAccountForm({ onSuccess, onCancel }: AddBankAccountFormProps) {
  const [formData, setFormData] = useState({
    accountNumber: '',
    confirmAccountNumber: '',
    routingNumber: '',
    accountHolderName: '',
    accountType: 'checking'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'form' | 'verification'>('form');

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.accountNumber || !formData.confirmAccountNumber || 
        !formData.routingNumber || !formData.accountHolderName) {
      setError('All fields are required');
      return false;
    }

    if (formData.accountNumber !== formData.confirmAccountNumber) {
      setError('Account numbers do not match');
      return false;
    }

    if (formData.routingNumber.length !== 9) {
      setError('Routing number must be 9 digits');
      return false;
    }

    if (!/^\d+$/.test(formData.routingNumber)) {
      setError('Routing number must contain only numbers');
      return false;
    }

    if (formData.accountNumber.length < 4 || formData.accountNumber.length > 17) {
      setError('Account number must be between 4 and 17 digits');
      return false;
    }

    if (!/^\d+$/.test(formData.accountNumber)) {
      setError('Account number must contain only numbers');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/stripe/bank-accounts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountNumber: formData.accountNumber,
          routingNumber: formData.routingNumber,
          accountHolderName: formData.accountHolderName,
          accountType: formData.accountType
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add bank account');
      }

      const result = await response.json();
      
      if (result.success) {
        setStep('verification');
        setTimeout(() => {
          onSuccess(result.bankAccount);
        }, 2000);
      } else {
        throw new Error(result.error || 'Failed to add bank account');
      }
    } catch (err) {
      console.error('Error adding bank account:', err);
      setError(err instanceof Error ? err.message : 'Failed to add bank account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 'verification') {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-8">
          <CheckCircle className="h-12 w-12 text-green-600 mb-4" />
          <h4 className="text-lg font-medium mb-2">Bank Account Added Successfully!</h4>
          <p className="text-muted-foreground text-center mb-4">
            Your bank account has been added and is being verified by Stripe. 
            This process typically takes 1-2 business days.
          </p>
          <div className="text-sm text-muted-foreground">
            Redirecting you back...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building className="h-5 w-5" />
          Add Bank Account
        </CardTitle>
        <CardDescription>
          Enter your bank account details. All information is encrypted and processed securely by Stripe.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="accountHolderName">Account Holder Name</Label>
            <Input
              id="accountHolderName"
              type="text"
              value={formData.accountHolderName}
              onChange={(e) => handleInputChange('accountHolderName', e.target.value)}
              placeholder="Full name on the account"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="routingNumber">Routing Number</Label>
            <Input
              id="routingNumber"
              type="text"
              value={formData.routingNumber}
              onChange={(e) => handleInputChange('routingNumber', e.target.value.replace(/\D/g, '').slice(0, 9))}
              placeholder="9-digit routing number"
              disabled={loading}
              maxLength={9}
              required
            />
            <div className="text-xs text-muted-foreground">
              Usually found at the bottom left of your checks
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountNumber">Account Number</Label>
            <Input
              id="accountNumber"
              type="text"
              value={formData.accountNumber}
              onChange={(e) => handleInputChange('accountNumber', e.target.value.replace(/\D/g, '').slice(0, 17))}
              placeholder="Account number"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmAccountNumber">Confirm Account Number</Label>
            <Input
              id="confirmAccountNumber"
              type="text"
              value={formData.confirmAccountNumber}
              onChange={(e) => handleInputChange('confirmAccountNumber', e.target.value.replace(/\D/g, '').slice(0, 17))}
              placeholder="Re-enter account number"
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accountType">Account Type</Label>
            <Select 
              value={formData.accountType} 
              onValueChange={(value) => handleInputChange('accountType', value)}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select account type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="checking">Checking</SelectItem>
                <SelectItem value="savings">Savings</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-muted/30 p-4 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <div className="font-medium mb-1">Security Notice</div>
                <div className="text-muted-foreground">
                  Your bank account information is encrypted and processed securely by Stripe. 
                  WeWrite never stores your full account details on our servers.
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Adding Account...
                </>
              ) : (
                'Add Bank Account'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
