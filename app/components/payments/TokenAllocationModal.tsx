"use client";

import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/modal';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

import { Input } from '../ui/input';
import { ArrowRight, DollarSign, Users, LogIn, CreditCard, ExternalLink, Plus, Minus, Eye, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { cn } from '../../lib/utils';
import { useTokenIncrement } from '../../contexts/TokenIncrementContext';
import { useLogRocket } from '../../providers/LogRocketProvider';

interface TokenAllocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  userState: 'logged-out' | 'no-subscription' | 'with-subscription';
  tokenData: {
    totalTokens: number;
    allocatedTokens: number;
    availableTokens: number;
    currentPageAllocation: number;
    otherPagesTokens: number;
    pageTitle?: string;
  };
  allocations?: Array<{
    pageId: string;
    pageTitle: string;
    authorUsername: string;
    tokens: number;
  }>;
  // New props for token controls
  onTokenChange?: (change: number) => void;
  isPageOwner?: boolean;
  pageId?: string;
}

export function TokenAllocationModal({
  isOpen,
  onClose,
  userState,
  tokenData,
  allocations = [],
  onTokenChange,
  isPageOwner = false,
  pageId
}: TokenAllocationModalProps) {
  const router = useRouter();
  const { trackModalInteraction, trackTokenAllocation } = useLogRocket();

  // Debug logging
  console.log('🔍 TokenAllocationModal: Props received', {
    userState,
    tokenData,
    allocations,
    allocationsLength: allocations.length,
    isPageOwner,
    pageId,
    modalIsOpen: isOpen
  });

  // Use global increment amount context
  const { incrementAmount, customAmount, setCustomAmount, handleIncrementChange } = useTokenIncrement();

  // State for custom token input in composition bar
  const [customTokenInput, setCustomTokenInput] = useState(tokenData.currentPageAllocation.toString());

  // Keep custom token input in sync with actual token data
  useEffect(() => {
    setCustomTokenInput(tokenData.currentPageAllocation.toString());
  }, [tokenData.currentPageAllocation]);

  // URL tracking for Google Analytics and LogRocket tracking
  useEffect(() => {
    if (isOpen) {
      // Add hash to URL when modal opens
      window.history.pushState(null, '', '#token-allocation-modal');

      // Track modal open in LogRocket
      trackModalInteraction({
        modalType: 'token_allocation',
        action: 'open',
        source: userState
      });
    } else {
      // Remove hash when modal closes
      if (window.location.hash === '#token-allocation-modal') {
        window.history.pushState(null, '', window.location.pathname + window.location.search);
      }

      // Track modal close in LogRocket
      trackModalInteraction({
        modalType: 'token_allocation',
        action: 'close',
        source: userState
      });
    }
  }, [isOpen, userState, trackModalInteraction]);

  const handleLogin = () => {
    onClose();
    // Redirect to landing page so users can get "sold" on WeWrite first
    router.push('/');
  };

  const handleSubscribe = () => {
    onClose();
    router.push('/settings/subscription');
  };

  const handleTokenChange = (change: number) => {
    if (onTokenChange && !isPageOwner) {
      onTokenChange(change);

      // Track token allocation in LogRocket
      trackTokenAllocation({
        action: change > 0 ? 'allocate' : 'deallocate',
        amount: Math.abs(change),
        pageId: pageId,
        totalBalance: tokenData.totalTokens
      });
    }
  };

  const handleCustomTokenSubmit = () => {
    const newTokens = parseInt(customTokenInput) || 0;
    const currentTokens = tokenData.currentPageAllocation;
    const change = newTokens - currentTokens;

    if (change !== 0) {
      handleTokenChange(change);
    }
  };

  const handleViewAllPledges = async () => {
    console.log('🔍 TokenAllocationModal: View All Pledges button clicked');
    console.log('🔍 TokenAllocationModal: Current pathname:', window.location.pathname);

    try {
      // Close modal first
      onClose();
      console.log('🔍 TokenAllocationModal: Modal closed, navigating to spend-tokens');

      // Navigate immediately
      await router.push('/settings/spend-tokens#from-modal');
      console.log('🔍 TokenAllocationModal: Navigation completed');
    } catch (error) {
      console.error('🔍 TokenAllocationModal: Navigation error:', error);
      // Fallback to window.location if router fails
      window.location.href = '/settings/spend-tokens#from-modal';
    }
  };

  // Composition Bar Component - Updated with plus/minus buttons
  const renderCompositionBar = () => {
    if (isPageOwner) return null;

    // Calculate token values with correct math (same logic as PledgeBar)
    const totalTokens = tokenData.totalTokens;
    const allocatedTokens = tokenData.allocatedTokens;
    const currentPageAllocation = tokenData.currentPageAllocation;

    // Calculate other pages tokens: total allocated minus current page allocation
    // Allow negative values to show overspending
    const otherPagesTokens = Math.max(0, allocatedTokens - currentPageAllocation);

    // Calculate available tokens: total minus all allocations (other + current)
    const totalUsedTokens = otherPagesTokens + currentPageAllocation;
    const availableTokens = totalTokens - totalUsedTokens;

    // Calculate percentages for composition bar (order: other, this, available)
    const otherPagesPercentage = totalTokens > 0 ? (otherPagesTokens / totalTokens) * 100 : 0;
    const currentPagePercentage = totalTokens > 0 ? (currentPageAllocation / totalTokens) * 100 : 0;
    const availablePercentage = totalTokens > 0 ? (availableTokens / totalTokens) * 100 : 0;

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Token Allocation</span>
        </div>

        {/* Composition Bar with Plus/Minus buttons */}
        <div className="flex items-center gap-2">
          {/* Minus Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              handleTokenChange(-incrementAmount);
            }}
            disabled={currentPageAllocation <= 0}
          >
            <Minus className="h-4 w-4" />
          </Button>

          {/* Composition Bar */}
          <div className="bg-muted rounded-lg h-10 flex gap-1 p-1 flex-1">
          {/* Other pages */}
          {otherPagesPercentage > 0 && (
            <div
              className="h-full bg-muted-foreground/30 rounded-full flex items-center justify-center"
              style={{ width: `${otherPagesPercentage}%`, minWidth: '20px' }}
            >
              <span className="text-white font-medium text-xs">
                {Math.round(otherPagesTokens)}
              </span>
            </div>
          )}

          {/* Current page */}
          {currentPagePercentage > 0 && (
            <div
              className="h-full bg-primary rounded-full flex items-center justify-center"
              style={{ width: `${currentPagePercentage}%`, minWidth: '20px' }}
            >
              <span className="text-white font-medium text-xs">
                {Math.round(currentPageAllocation)}
              </span>
            </div>
          )}

          {/* Available/Unfunded */}
          {availablePercentage > 0 && (
            <div
              className="h-full bg-muted-foreground/10 rounded-full flex items-center justify-center"
              style={{ width: `${availablePercentage}%`, minWidth: '20px' }}
            >
              <span className="text-muted-foreground font-medium text-xs">
                {Math.round(Math.abs(availableTokens))}
              </span>
            </div>
          )}
          </div>

          {/* Plus Button */}
          <Button
            variant="outline"
            size="sm"
            className="h-10 w-10 p-0 flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              if (availableTokens <= 0) {
                // Redirect to subscription page when out of tokens
                handleSubscribe();
              } else {
                handleTokenChange(incrementAmount);
              }
            }}
            disabled={false}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Legend */}
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Other pages: {Math.round(otherPagesTokens)}</span>
          <span>This page: {Math.round(currentPageAllocation)}</span>
          <span>{availableTokens < 0 ? 'Unfunded tokens' : 'Available'}: {Math.round(Math.abs(availableTokens))}</span>
        </div>
      </div>
    );
  };

  // Token Controls Component (used in all states if not page owner)
  const renderTokenControls = () => {
    if (isPageOwner) return null;

    return (
      <div className="space-y-4">


        {/* Current Page Allocation - Clickable Input */}
        <div className="text-center p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors"
             onClick={() => {
               const input = document.createElement('input');
               input.type = 'number';
               input.value = tokenData.currentPageAllocation.toString();
               input.className = 'text-2xl font-bold text-primary text-center bg-transparent border-none outline-none w-full';
               input.min = '0';
               input.max = (tokenData.availableTokens + tokenData.currentPageAllocation).toString();

               const numberDiv = document.querySelector('.token-allocation-number');
               if (numberDiv) {
                 numberDiv.innerHTML = '';
                 numberDiv.appendChild(input);
                 input.focus();
                 input.select();

                 const handleSubmit = () => {
                   const newTokens = parseInt(input.value) || 0;
                   const currentTokens = tokenData.currentPageAllocation;
                   const change = newTokens - currentTokens;

                   if (change !== 0) {
                     handleTokenChange(change);
                   }

                   numberDiv.innerHTML = newTokens.toString();
                 };

                 input.addEventListener('blur', handleSubmit);
                 input.addEventListener('keydown', (e) => {
                   if (e.key === 'Enter') {
                     handleSubmit();
                   }
                 });
               }
             }}>
          <div className="text-2xl font-bold text-primary mb-1 token-allocation-number">
            {tokenData.currentPageAllocation}
          </div>
          <div className="text-sm text-muted-foreground">
            tokens allocated to "{tokenData.pageTitle || 'this page'}"
          </div>
        </div>



        {/* Increment Amount Selector */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Tokens per click</label>
          <div className="flex gap-2">
            {[1, 5, 10].map((amount) => (
              <Button
                key={amount}
                variant={incrementAmount === amount ? "default" : "outline"}
                size="sm"
                onClick={() => handleIncrementChange(amount)}
                className="flex-1"
              >
                {amount}
              </Button>
            ))}
            <Input
              type="number"
              placeholder="Custom"
              value={customAmount}
              onChange={(e) => setCustomAmount(e.target.value)}
              onBlur={() => {
                if (customAmount && parseInt(customAmount) >= 1) {
                  handleIncrementChange('custom');
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && customAmount && parseInt(customAmount) >= 1) {
                  handleIncrementChange('custom');
                }
              }}
              className="w-20 h-8 text-xs"
              min="1"
              max="100"
            />
          </div>
        </div>


      </div>
    );
  };

  // Top 5 Allocations Component
  const renderTop5Allocations = () => {
    if (isPageOwner) return null;

    // Get top 5 allocations (excluding current page if it's in the list)
    const otherAllocations = allocations.filter(allocation => allocation.pageId !== pageId);
    const top5 = otherAllocations.slice(0, 5);

    console.log('🔍 TokenAllocationModal: renderTop5Allocations', {
      allocations,
      allocationsLength: allocations.length,
      pageId,
      otherAllocations,
      otherAllocationsLength: otherAllocations.length,
      top5,
      top5Length: top5.length,
      isPageOwner
    });

    return (
      <div className="space-y-3">
        <h4 className="font-medium text-sm">Top Allocated Pages</h4>
        {top5.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              You haven't allocated tokens to any other pages yet
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {top5.map((allocation, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{allocation.pageTitle}</div>
                  <div className="text-xs text-muted-foreground">by {allocation.authorUsername}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {allocation.tokens} tokens
                  </Badge>
                  <Link href={`/${allocation.pageId}`}>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // View All Button Component
  const renderViewAllButton = () => {
    if (isPageOwner) return null;

    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleViewAllPledges}
        className="w-full"
      >
        <Eye className="h-4 w-4 mr-2" />
        View All Other Pledges
      </Button>
    );
  };

  const renderLoggedOutContent = () => (
    <div className="space-y-6">
      {/* Banner */}
      <div
        className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-4 rounded-lg cursor-pointer hover:from-blue-600 hover:to-blue-700 transition-colors flex items-center justify-between"
        onClick={handleLogin}
      >
        <div>
          <h3 className="font-semibold text-lg mb-2">Log in to begin allocating tokens</h3>
          <p className="text-blue-100 text-sm">
            Create an account to start supporting writers with real tokens
          </p>
        </div>
        <ChevronRight className="h-6 w-6 text-blue-100" />
      </div>

      {/* Composition Bar */}
      {renderCompositionBar()}

      {/* Token Controls */}
      {renderTokenControls()}
    </div>
  );

  const renderNoSubscriptionContent = () => (
    <div className="space-y-6">
      {/* Banner */}
      <div
        className="bg-gradient-to-r from-orange-500 to-orange-600 text-white p-4 rounded-lg cursor-pointer hover:from-orange-600 hover:to-orange-700 transition-colors flex items-center justify-between"
        onClick={handleSubscribe}
      >
        <div>
          <h3 className="font-semibold text-lg mb-2">Start your subscription to support writers</h3>
          <p className="text-orange-100 text-sm">
            Subscribe to get real tokens that directly support the writers you love
          </p>
        </div>
        <ChevronRight className="h-6 w-6 text-orange-100" />
      </div>

      {/* Composition Bar */}
      {renderCompositionBar()}

      {/* Token Controls */}
      {renderTokenControls()}
    </div>
  );

  const renderWithSubscriptionContent = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h3 className="font-semibold text-lg mb-2">Token Allocation Breakdown</h3>
        <p className="text-sm text-muted-foreground">
          Your monthly token allocations to writers
        </p>
      </div>

      {/* Composition Bar */}
      {renderCompositionBar()}

      {/* Token Controls */}
      {renderTokenControls()}

      {/* Top 5 Allocations */}
      {renderTop5Allocations()}

      {/* View All Button */}
      {renderViewAllButton()}

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Button variant="ghost" onClick={onClose} className="w-full">
          Close
        </Button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (userState) {
      case 'logged-out':
        return renderLoggedOutContent();
      case 'no-subscription':
        return renderNoSubscriptionContent();
      case 'with-subscription':
        return renderWithSubscriptionContent();
      default:
        return null;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-md mx-4"
      showCloseButton={true}
    >
      {renderContent()}
    </Modal>
  );
}
