"use client";

import React, { useState, useEffect } from 'react';
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";

import { 
  AlertTriangle, 
  AlertCircle, 
  Minus, 
  Plus, 
  CheckCircle, 
  Clock,
  DollarSign,
  TrendingDown,
  RefreshCw
} from "lucide-react";
import { cn } from "../../lib/utils";
import {
  validatePledgeBudget,
  reducePledgeAmount,
  getRestorationSuggestions,
  restorePledgesFromSuggestions,
  type BudgetValidationResult,
  type PledgeItem
} from '../../services/pledgeBudgetService';

interface PledgeBarExceededBudgetProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function PledgeBarExceededBudget({
  isOpen,
  onClose,
  userId
}: PledgeBarExceededBudgetProps) {
  const [budgetValidation, setBudgetValidation] = useState<BudgetValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [updatingPledge, setUpdatingPledge] = useState<string | null>(null);
  const [localPledges, setLocalPledges] = useState<PledgeItem[]>([]);
  const [restorationSuggestions, setRestorationSuggestions] = useState<PledgeItem[]>([]);
  const [showRestorations, setShowRestorations] = useState(false);

  // Load budget validation data
  useEffect(() => {
    if (isOpen && userId) {
      loadBudgetData();
    }
  }, [isOpen, userId]);

  const loadBudgetData = async () => {
    setLoading(true);
    try {
      const validation = await validatePledgeBudget(userId);
      setBudgetValidation(validation);
      
      // Combine active and suspended pledges for management
      const allPledges = [...validation.activePledges, ...validation.suspendedPledges];
      // Sort by amount (largest first) for easy identification and management
      // This ensures largest pledges (first to be suspended) appear at the top
      allPledges.sort((a, b) => b.amount - a.amount);
      setLocalPledges(allPledges);

      // Load restoration suggestions if user has available budget
      if (validation.subscriptionBudget > validation.totalPledges) {
        const suggestions = await getRestorationSuggestions(userId);
        setRestorationSuggestions(suggestions);
        setShowRestorations(suggestions.length > 0);
      } else {
        setRestorationSuggestions([]);
        setShowRestorations(false);
      }
    } catch (error) {
      console.error('Error loading budget data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePledgeReduction = async (pledgeId: string, currentAmount: number, reductionAmount: number) => {
    const newAmount = Math.max(0, currentAmount - reductionAmount);

    setUpdatingPledge(pledgeId);
    try {
      // Use API endpoint for pledge updates
      const response = await fetch('/api/tokens/pledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pageId: pledgeId,
          newAmount: newAmount
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update pledge');
      }

      // Update local state optimistically
      setLocalPledges(prev => prev.map(pledge =>
        pledge.id === pledgeId
          ? { ...pledge, amount: newAmount }
          : pledge
      ));

      // Reload budget validation
      await loadBudgetData();
    } catch (error) {
      console.error('Error reducing pledge:', error);
    } finally {
      setUpdatingPledge(null);
    }
  };

  const handleQuickFix = async () => {
    if (!budgetValidation || !budgetValidation.isOverBudget) return;

    setLoading(true);
    try {
      // Reduce largest pledges first until within budget
      let remainingOverBudget = budgetValidation.overBudgetAmount;
      const pledgesToReduce = [...budgetValidation.suspendedPledges];
      
      for (const pledge of pledgesToReduce) {
        if (remainingOverBudget <= 0) break;
        
        const reductionNeeded = Math.min(pledge.amount, remainingOverBudget);
        const newAmount = pledge.amount - reductionNeeded;
        
        await reducePledgeAmount(userId, pledge.id, newAmount);
        remainingOverBudget -= reductionNeeded;
      }
      
      // Reload data
      await loadBudgetData();
    } catch (error) {
      console.error('Error applying quick fix:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPledgeStatusInfo = (pledge: PledgeItem) => {
    switch (pledge.status) {
      case 'active':
        return {
          icon: CheckCircle,
          color: 'text-green-600',
          bgColor: 'bg-green-50 border-green-200',
          label: 'Active',
          description: 'This pledge is within your budget'
        };
      case 'suspended':
        return {
          icon: Clock,
          color: 'text-yellow-600',
          bgColor: 'bg-yellow-50 border-yellow-200',
          label: 'Suspended',
          description: 'Suspended due to subscription status'
        };
      case 'over_budget':
        return {
          icon: AlertTriangle,
          color: 'text-red-600',
          bgColor: 'bg-red-50 border-red-200',
          label: 'Over Budget',
          description: 'This pledge exceeds your available budget'
        };
      default:
        return {
          icon: AlertCircle,
          color: 'text-gray-600',
          bgColor: 'bg-gray-50 border-gray-200',
          label: 'Unknown',
          description: 'Status unknown'
        };
    }
  };

  const renderPledgeItem = (pledge: PledgeItem) => {
    const statusInfo = getPledgeStatusInfo(pledge);
    const StatusIcon = statusInfo.icon;
    const isUpdating = updatingPledge === pledge.id;

    return (
      <div
        key={pledge.id}
        className={cn(
          "p-4 rounded-lg border transition-all duration-200",
          statusInfo.bgColor,
          isUpdating && "opacity-50"
        )}
      >
        <div className="flex items-start justify-between mb-2">
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{pledge.pageTitle}</h4>
            <p className="text-xs text-muted-foreground">by {pledge.authorUsername}</p>
          </div>
          <div className="flex items-center gap-2 ml-2">
            <Badge variant="outline" className={cn("text-xs", statusInfo.color)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusInfo.label}
            </Badge>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-lg">{pledge.amount}</span>
            <span className="text-sm text-muted-foreground">tokens/month</span>
          </div>
          
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handlePledgeReduction(pledge.id, pledge.amount, 1)}
              disabled={isUpdating || pledge.amount <= 0}
              className="h-8 w-8 p-0"
            >
              <Minus className="h-3 w-3" />
            </Button>
            
            {pledge.status === 'over_budget' && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handlePledgeReduction(pledge.id, pledge.amount, Math.ceil(pledge.amount / 2))}
                disabled={isUpdating}
                className="h-8 text-xs px-2"
              >
                <TrendingDown className="h-3 w-3 mr-1" />
                Reduce 50%
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-2">{statusInfo.description}</p>
      </div>
    );
  };

  const content = (
    <div className="space-y-4">
      {loading ? (
        <div className="text-center py-8">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-2 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading pledge data...</p>
        </div>
      ) : budgetValidation ? (
        <>
          {/* Budget Summary */}
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Budget Summary</span>
              {budgetValidation.isOverBudget && (
                <Badge variant="destructive">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  Over Budget
                </Badge>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Total Pledges</p>
                <p className="font-semibold">{budgetValidation.totalPledges} tokens</p>
              </div>
              <div>
                <p className="text-muted-foreground">Monthly Budget</p>
                <p className="font-semibold">{budgetValidation.subscriptionBudget} tokens</p>
              </div>
            </div>
            
            {budgetValidation.isOverBudget && (
              <div className="mt-3 p-2 bg-destructive/10 rounded border border-destructive/20">
                <p className="text-sm text-destructive font-medium">
                  Over budget by {budgetValidation.overBudgetAmount} tokens
                </p>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={handleQuickFix}
                  disabled={loading}
                  className="mt-2 h-7 text-xs"
                >
                  <TrendingDown className="h-3 w-3 mr-1" />
                  Auto-Fix (Reduce Largest)
                </Button>
              </div>
            )}
          </div>

          {/* Restoration Suggestions */}
          {showRestorations && restorationSuggestions.length > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-green-800">Restoration Available</span>
                <Badge variant="outline" className="text-green-700 border-green-300">
                  {restorationSuggestions.length} suggestion{restorationSuggestions.length > 1 ? 's' : ''}
                </Badge>
              </div>

              <p className="text-sm text-green-700 mb-3">
                You have budget available to restore {restorationSuggestions.length} previously suspended pledge{restorationSuggestions.length > 1 ? 's' : ''}.
              </p>

              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  setLoading(true);
                  try {
                    const availableBudget = budgetValidation.subscriptionBudget - budgetValidation.totalPledges;
                    const result = await restorePledgesFromSuggestions(userId, restorationSuggestions, availableBudget);

                    if (result.restored.length > 0) {
                      // Reload data to show restored pledges
                      await loadBudgetData();
                    }
                  } catch (error) {
                    console.error('Error restoring pledges:', error);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-100"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Restore Previous Pledges
              </Button>
            </div>
          )}

          {/* Pledge List */}
          <div className="space-y-3">
            <h3 className="font-medium text-sm">Your Pledges ({localPledges.length})</h3>
            
            {localPledges.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No pledges found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {localPledges.map(renderPledgeItem)}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <AlertCircle className="h-8 w-8 mx-auto mb-2" />
          <p className="text-sm">Unable to load pledge data</p>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Pledges</DialogTitle>
          <DialogDescription>
            Adjust your pledges to fit within your subscription budget
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
