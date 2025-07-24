"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { SubscriptionUpgradeFlow } from './SubscriptionUpgradeFlow';
import { useAuth } from '../../providers/AuthProvider';
import { 
  ArrowUpCircle, 
  ArrowDownCircle, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle,
  Copy,
  Loader2,
  TrendingUp,
  TrendingDown,
  Edit3
} from 'lucide-react';
import { toast } from '../ui/use-toast';

import { SUBSCRIPTION_TIERS, CUSTOM_TIER_CONFIG, getTierById, calculateTokensForAmount, validateCustomAmount } from '../../utils/subscriptionTiers';

interface SubscriptionModificationProps {
  subscription: any;
  onModificationSuccess?: () => void;
}

interface ProrationPreview {
  currentAmount: number;
  newAmount: number;
  prorationAmount: number;
  nextBillingAmount: number;
  isUpgrade: boolean;
  description: string;
}

export function SubscriptionModification({ subscription, onModificationSuccess }: SubscriptionModificationProps) {
  const { user } = useAuth();
  // Payments feature is now always enabled
  // Payments are always enabled - no feature flag needed
  
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [customAmount, setCustomAmount] = useState<number>(60);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showUpgradeFlow, setShowUpgradeFlow] = useState(false);
  const [showCustomAmountDialog, setShowCustomAmountDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prorationPreview, setProrationPreview] = useState<ProrationPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Don't render if payments feature is disabled or no subscription
  if (!subscription) {
    return null;
  }

  const currentTier = subscription.tier;
  const currentAmount = subscription.amount;

  useEffect(() => {
    // Set initial custom amount based on current subscription if it's custom
    if (currentTier === 'custom') {
      setCustomAmount(currentAmount);
    }
  }, [currentTier, currentAmount]);

  const handleTierSelect = async (tierId: string) => {
    if (tierId === currentTier) {
      toast.info('You are already on this tier');
      return;
    }

    setSelectedTier(tierId);
    setError(null);

    // Get proration preview
    await getProrationPreview(tierId, tierId === 'custom' ? customAmount : undefined);

    // Show the upgrade flow with payment method selection
    setShowUpgradeFlow(true);
  };

  const handleCustomAmountSelect = () => {
    setShowCustomAmountDialog(true);
  };

  const handleCustomAmountConfirm = async () => {
    if (customAmount === currentAmount && currentTier === 'custom') {
      toast.info('Amount is the same as your current subscription');
      setShowCustomAmountDialog(false);
      return;
    }

    const validation = validateCustomAmount(customAmount);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    setSelectedTier('custom');
    setShowCustomAmountDialog(false);
    
    // Get proration preview for custom amount
    await getProrationPreview('custom', customAmount);
  };

  const getProrationPreview = async (tierId: string, amount?: number) => {
    if (!subscription.stripeSubscriptionId) {
      setError('No Stripe subscription ID found');
      return;
    }

    setLoadingPreview(true);
    setError(null);

    try {
      const response = await fetch('/api/subscription/preview-change', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'},
        body: JSON.stringify({
          subscriptionId: subscription.stripeSubscriptionId,
          newTier: tierId,
          newAmount: amount})});

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get proration preview');
      }

      setProrationPreview(data.preview);
      setShowConfirmDialog(true);
    } catch (err: any) {
      console.error('Error getting proration preview:', err);
      setError(err.message || 'Failed to get proration preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleConfirmModification = async () => {
    if (!selectedTier || !subscription.stripeSubscriptionId) {
      setError('Missing required information');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Calculate the new amount based on selected tier
      let newAmount: number;
      if (selectedTier === 'custom') {
        newAmount = customAmount;
      } else {
        const tier = getTierById(selectedTier);
        if (!tier) {
          throw new Error('Invalid tier selected');
        }
        newAmount = tier.amount;
      }

      // Call the subscription update API
      const response = await fetch('/api/subscription/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: subscription.stripeSubscriptionId,
          newTier: selectedTier,
          newAmount: newAmount
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update subscription');
      }

      toast.success('Subscription updated successfully!');
      setShowConfirmDialog(false);
      setSelectedTier('');
      setProrationPreview(null);

      if (onModificationSuccess) {
        onModificationSuccess();
      }
    } catch (err: any) {
      console.error('Error updating subscription:', err);
      const errorMessage = err.message || 'Failed to update subscription';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const getTierDisplayName = (tierId: string) => {
    if (tierId === 'custom') return 'Custom';
    const tier = getTierById(tierId);
    return tier ? tier.name : 'Unknown';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'}).format(amount);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Edit3 className="h-5 w-5" />
            Modify Subscription
          </CardTitle>
          <CardDescription>
            Change your subscription tier or amount. Changes are prorated and take effect immediately.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {error}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2 h-auto p-0 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(error);
                    toast.success('Error message copied to clipboard');
                  }}
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Current Subscription */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <h4 className="font-medium mb-2">Current Subscription</h4>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">{getTierDisplayName(currentTier)}</p>
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(currentAmount)}/month • {calculateTokensForAmount(currentAmount)} tokens
                </p>
              </div>
              <Badge variant="outline">Active</Badge>
            </div>
          </div>

          {/* Tier Options */}
          <div className="space-y-3">
            <h4 className="font-medium">Choose New Tier</h4>
            
            {/* Standard Tiers */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {SUBSCRIPTION_TIERS.map((tier) => {
                const isCurrentTier = tier.id === currentTier && tier.amount === currentAmount;
                const isUpgrade = tier.amount > currentAmount;
                const isDowngrade = tier.amount < currentAmount;
                
                return (
                  <button
                    key={tier.id}
                    onClick={() => handleTierSelect(tier.id)}
                    disabled={isCurrentTier || loadingPreview}
                    className={`relative p-4 rounded-lg border-2 text-left transition-all ${
                      isCurrentTier
                        ? 'border-primary bg-primary/10 opacity-60 cursor-not-allowed'
                        : 'border-border hover:border-primary/50 hover:bg-accent/50'
                    } ${tier.popular ? 'ring-2 ring-primary/30' : ''}`}
                  >
                    {tier.popular && (
                      <Badge className="absolute -top-2 left-4 bg-primary text-primary-foreground">
                        Popular
                      </Badge>
                    )}
                    
                    <div className="flex items-start justify-between mb-2">
                      <h5 className="font-medium">{tier.name}</h5>
                      {isUpgrade && <TrendingUp className="h-4 w-4 text-green-600" />}
                      {isDowngrade && <TrendingDown className="h-4 w-4 text-orange-600" />}
                    </div>
                    
                    <p className="text-lg font-bold mb-1">{formatCurrency(tier.amount)}</p>
                    <p className="text-sm text-muted-foreground mb-2">{tier.tokens} tokens/month</p>
                    <p className="text-xs text-muted-foreground">{tier.description}</p>
                    
                    {isCurrentTier && (
                      <Badge variant="outline" className="mt-2">Current</Badge>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Custom Amount Option */}
            <div className="border-2 border-dashed border-border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h5 className="font-medium">Custom Amount</h5>
                  <p className="text-sm text-muted-foreground">
                    ${CUSTOM_TIER_CONFIG.minAmount}+ per month
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={handleCustomAmountSelect}
                  disabled={loadingPreview}
                >
                  <DollarSign className="h-4 w-4 mr-2" />
                  Set Custom Amount
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Amount Dialog */}
      <Dialog open={showCustomAmountDialog} onOpenChange={setShowCustomAmountDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Custom Amount</DialogTitle>
            <DialogDescription>
              Choose a custom monthly subscription amount (minimum ${CUSTOM_TIER_CONFIG.minAmount}).
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="custom-amount">Monthly Amount (USD)</Label>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-lg">$</span>
              <Input
                id="custom-amount"
                type="number"
                min={CUSTOM_TIER_CONFIG.minAmount}
                max={CUSTOM_TIER_CONFIG.maxAmount}
                step="1"
                value={customAmount}
                onChange={(e) => setCustomAmount(Number(e.target.value))}
                className="text-lg"
              />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              You'll receive {calculateTokensForAmount(customAmount)} tokens per month
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCustomAmountDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCustomAmountConfirm}>
              Continue
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog with Proration Preview */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Subscription Change</DialogTitle>
            <DialogDescription>
              Review the changes and proration details before confirming.
            </DialogDescription>
          </DialogHeader>
          
          {prorationPreview && (
            <div className="py-4 space-y-4">
              {/* Change Summary */}
              <div className="p-4 bg-muted/50 rounded-lg">
                <h4 className="font-medium mb-2">Change Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Current:</span>
                    <span>{getTierDisplayName(currentTier)} - {formatCurrency(prorationPreview.currentAmount)}/month</span>
                  </div>
                  <div className="flex justify-between">
                    <span>New:</span>
                    <span>{getTierDisplayName(selectedTier)} - {formatCurrency(prorationPreview.newAmount)}/month</span>
                  </div>
                </div>
              </div>

              {/* Proration Details */}
              <div className="p-4 border rounded-lg">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  {prorationPreview.isUpgrade ? (
                    <ArrowUpCircle className="h-4 w-4 text-green-600" />
                  ) : (
                    <ArrowDownCircle className="h-4 w-4 text-orange-600" />
                  )}
                  {prorationPreview.isUpgrade ? 'Upgrade' : 'Downgrade'} Details
                </h4>
                <div className="space-y-2 text-sm">
                  <p className="text-muted-foreground">{prorationPreview.description}</p>

                  {prorationPreview.prorationAmount !== 0 && (
                    <div className="flex justify-between">
                      <span>{prorationPreview.isUpgrade ? 'Immediate charge:' : 'Credit applied:'}</span>
                      <span className={prorationPreview.isUpgrade ? 'text-red-600' : 'text-green-600'}>
                        {prorationPreview.isUpgrade ? '+' : '-'}{formatCurrency(Math.abs(prorationPreview.prorationAmount))}
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between font-medium">
                    <span>Next billing amount:</span>
                    <span>{formatCurrency(prorationPreview.nextBillingAmount)}</span>
                  </div>
                </div>
              </div>

              {/* Important Notes */}
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Important</AlertTitle>
                <AlertDescription className="text-sm">
                  <ul className="list-disc list-inside space-y-1 mt-2">
                    <li>Changes take effect immediately</li>
                    <li>Your token allocation will be updated for the new tier</li>
                    <li>Existing pledges will remain unchanged</li>
                    {prorationPreview.isUpgrade && (
                      <li>You'll be charged the prorated amount now</li>
                    )}
                    {!prorationPreview.isUpgrade && (
                      <li>You'll receive a credit for the unused portion</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmModification}
              disabled={loading}
              className={prorationPreview?.isUpgrade ? 'bg-green-600 hover:bg-green-700' : ''}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Confirm Change
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Subscription Upgrade Flow Modal */}
      <Dialog open={showUpgradeFlow} onOpenChange={setShowUpgradeFlow}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upgrade Subscription</DialogTitle>
            <DialogDescription>
              Review your upgrade and confirm payment method
            </DialogDescription>
          </DialogHeader>
          <SubscriptionUpgradeFlow
            currentSubscription={subscription}
            newTier={selectedTier}
            newAmount={selectedTier === 'custom' ? customAmount : getTierById(selectedTier)?.amount || 0}
            onSuccess={() => {
              setShowUpgradeFlow(false);
              setSelectedTier('');
              onModificationSuccess?.();
            }}
            onCancel={() => {
              setShowUpgradeFlow(false);
              setSelectedTier('');
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}