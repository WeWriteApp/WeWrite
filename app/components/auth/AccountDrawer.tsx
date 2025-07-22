"use client";

import React, { useState, useEffect } from 'react';
import { Drawer } from 'vaul';
import { UserCircle, CreditCard, Settings, Plus, Minus, Trash2, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import TokenAllocationBar from '../editor/TokenAllocationBar';
import { updateUsername } from "../../firebase/usernameHistory";
import { useAlert } from '../../hooks/useAlert';
import AlertModal from '../utils/AlertModal';

interface Pledge {
  id: string;
  pageId: string;
  title: string;
  amount: number;
  createdAt?: any;
  updatedAt?: any;
}

interface Subscription {
  id?: string;
  amount: number;
  status: string;
  billingCycleEnd?: string;
  pledgedAmount?: number;
  stripeCustomerId?: string;
  stripePriceId?: string;
  stripeSubscriptionId?: string | null;
}

interface AccountDrawerProps {
  username: string;
  email: string;
  subscription: Subscription | null;
  timeUntilPayment: string;
  onUsernameChange: (username: string) => void;
  onSubscriptionCancel: () => void;
  onSubscriptionActivate: (amount: number | string) => void;
  globalIncrement: number;
  onIncrementChange: (increment: number) => void;
  onSaveCustomIncrement: (amount: string) => void;
  customIncrementAmount: string;
  autoOpen?: boolean;
  pledges?: Pledge[];
  onPledgeAmountChange?: (pledgeId: string, change: number) => void;
  onPledgeCustomAmount?: (pledgeId: string) => void;
  onDeletePledge?: (pledgeId: string) => void;
  needsSort?: boolean;
}

const SpendingOverview = ({ total, max }: { total: number, max: number }) => {
  const percentage = max > 0 ? Math.min(100, (total / max) * 100) : 0;
  const isExceeded = total > max;

  return (
    <div className="mt-4 p-4 bg-background/60 rounded-md shadow-sm border border-border/40">
      <div className="flex justify-between mb-2">
        <h3 className="text-sm font-medium">Current Spending</h3>
        <div className="text-right">
          <span className={`text-sm font-medium ${isExceeded ? 'text-orange-500' : ''}`}>${total.toFixed(2)}</span>
          <span className="text-sm text-muted-foreground"> / ${max.toFixed(2)}</span>
        </div>
      </div>

      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${isExceeded ? 'bg-orange-500' : 'bg-green-500'}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>

      {isExceeded && (
        <p className="mt-2 text-xs text-orange-500 flex items-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Pledges exceed subscription amount
        </p>
      )}
    </div>
  );
};

// Simple toast replacement functions - will be replaced with modal
const showErrorMessage = (message: string, showAlert?: (title: string, message: string) => void) => {
  console.error(message);
  if (showAlert) {
    showAlert('Error', message);
  } else {
    // Fallback for backward compatibility
    alert(message);
  }
};

const showLoadingMessage = (message: string) => {
  // You could add DOM-based notification here if needed
};

const AccountDrawer = ({
  username,
  email,
  subscription,
  timeUntilPayment,
  onUsernameChange,
  onSubscriptionCancel,
  onSubscriptionActivate,
  globalIncrement,
  onIncrementChange,
  onSaveCustomIncrement,
  customIncrementAmount,
  autoOpen = false,
  pledges = [],
  onPledgeAmountChange = () => {},
  onPledgeCustomAmount = () => {},
  onDeletePledge = () => {},
  needsSort = false
}: AccountDrawerProps) => {
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editedUsername, setEditedUsername] = useState(username);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | 'custom' | null>(null);
  const [showCustomIncrementModal, setShowCustomIncrementModal] = useState(false);
  const [customIncrementValue, setCustomIncrementValue] = useState(customIncrementAmount);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const router = useRouter();

  // Custom modal hooks
  const { alertState, showError, closeAlert } = useAlert();

  useEffect(() => {
    if (subscription && subscription.amount) {
      if ([10, 20, 50, 100].includes(subscription.amount)) {
        setSelectedAmount(subscription.amount);
      } else {
        setSelectedAmount('custom');
        setCustomAmount(subscription.amount.toString());
      }
    } else {
      setSelectedAmount(20);
    }
  }, [subscription]);

  useEffect(() => {
    console.log("Global increment updated:", globalIncrement);
  }, [globalIncrement]);

  // Add effect to refresh data when drawer is opened
  useEffect(() => {
    if (isOpen) {
      console.log("Drawer opened, refreshing subscription data");
      // Force parent component to reload data
      // This will ensure subscription changes are reflected
      onDeletePledge('refresh-data');
    }
  }, [isOpen, onDeletePledge]);

  const handleUsernameUpdate = async () => {
    try {
      // First update the username in Firebase and record the change in history
      // We need to get the actual userId from the auth context, but since we don't have it directly,
      // we'll use the email as a fallback. In a real implementation, you would pass the actual userId.
      const userId = localStorage.getItem('userId') || 'unknown-user'; // SECURITY: Never expose email
      await updateUsername(userId, editedUsername);

      // Then call the parent's onUsernameChange handler
      onUsernameChange(editedUsername);

      // Close the edit form
      setIsEditingUsername(false);
    } catch (error) {
      console.error("Error updating username:", error);
      showErrorMessage('Failed to update username. Please try again.', showError);
    }
  };

  const handleActivateSubscription = () => {
    console.log("handleActivateSubscription called with selectedAmount:", selectedAmount);

    if (!selectedAmount) {
      showErrorMessage('Please select a subscription amount', showError);
      return;
    }

    try {
      // Show loading state
      showLoadingMessage('Connecting to payment provider...');

      if (selectedAmount === 'custom') {
        if (!customAmount || Number(customAmount) <= 0) {
          showErrorMessage('Please enter a valid custom amount', showError);
          return;
        }
        console.log("Activating custom subscription:", customAmount);

        // Call the parent handler with the custom amount
        onSubscriptionActivate(customAmount);
      } else {
        console.log("Activating fixed subscription:", selectedAmount);

        // Call the parent handler with the selected amount
        onSubscriptionActivate(selectedAmount);
      }
    } catch (error) {
      console.error("Error starting subscription:", error);
      showErrorMessage('Failed to start subscription. Please try again.', showError);
    }
  };

  const handleCancelSubscription = () => {
    onSubscriptionCancel();
    setShowCancelConfirmation(false);
  };

  const handleSaveCustomIncrement = () => {
    onSaveCustomIncrement(customIncrementValue);
    setShowCustomIncrementModal(false);
  };

  const handleCloseDrawer = () => {
    setIsOpen(false);
  };

  const totalPledgedAmount = pledges.reduce((total, pledge) => total + Number(pledge.amount), 0);

  const handleSortToggle = () => {
    const newDirection = sortDirection === 'desc' ? 'asc' : 'desc';
    console.log(`Toggling sort direction from ${sortDirection} to ${newDirection}`);
    setSortDirection(newDirection);
    onDeletePledge(`sort-${newDirection}`);
  };

  return (
    <>
      {!autoOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg bg-background/80 hover:bg-background/90 border border-border/50 shadow-sm transition-colors"
        >
          <UserCircle size={18} />
          <span>Account</span>
        </button>
      )}

      <Drawer.Root
        open={isOpen}
        onOpenChange={(isOpen) => {
          setIsOpen(isOpen);
        }}
        dismissible={true}
        shouldScaleBackground={true}
      >
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Drawer.Content
            className="bg-background flex flex-col rounded-t-[10px] h-[90%] mt-24 fixed bottom-0 left-0 right-0 z-50 overscroll-contain"
          >
            {/* Interactive pull handle for dismiss */}
            <div
              className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-muted my-4 cursor-grab active:cursor-grabbing"
              onTouchStart={(e) => e.stopPropagation()}
            />

            <div className="p-4 bg-background flex-shrink-0">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Account Settings</h2>
                <button
                  onClick={handleCloseDrawer}
                  className="p-1 hover:bg-muted rounded-full"
                  aria-label="Close"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto overscroll-contain px-4 pb-8">
              {/* Profile Section */}
              <section className="mb-8">
                <h3 className="text-base font-medium mb-4">Profile</h3>
                <div className="space-y-4 p-4 bg-background/40 rounded-lg border border-border/40">
                  <div>
                    <label className="block text-sm font-medium text-foreground/80 mb-1">Username</label>
                    {isEditingUsername ? (
                      <div className="flex space-x-2">
                        <input
                          type="text"
                          value={editedUsername}
                          onChange={(e) => setEditedUsername(e.target.value)}
                          className="w-full px-3 py-2 bg-background border border-input rounded-md"
                          placeholder="Enter username"
                        />
                        <button
                          onClick={handleUsernameUpdate}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setIsEditingUsername(false)}
                          className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex justify-between items-center">
                        <p className="text-foreground">{username || 'No username set'}</p>
                        <button
                          onClick={() => setIsEditingUsername(true)}
                          className="text-sm text-foreground/60 hover:text-foreground"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-foreground/80 mb-1">Email</label>
                    <div className="flex justify-between items-center">
                      <p className="text-foreground">{email || 'No email set'}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Subscription Section */}
              <section className="mb-8">
                <h3 className="text-base font-medium mb-4">Subscription</h3>
                <div className="space-y-4 p-4 bg-background/40 rounded-lg border border-border/40">
                  {subscription?.status === 'active' ? (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Monthly Amount</span>
                        <span className="text-lg font-semibold">${subscription.amount}/mo</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium">Next Payment</span>
                        <span className="text-sm text-foreground/70">{timeUntilPayment}</span>
                      </div>

                      {showCancelConfirmation ? (
                        <div className="p-3 bg-destructive/10 rounded-md">
                          <p className="text-sm mb-3">Are you sure you want to cancel your subscription?</p>
                          <div className="flex space-x-2 justify-end">
                            <button
                              onClick={() => setShowCancelConfirmation(false)}
                              className="px-3 py-1.5 text-sm bg-secondary text-secondary-foreground rounded"
                            >
                              Keep
                            </button>
                            <button
                              onClick={handleCancelSubscription}
                              className="px-3 py-1.5 text-sm bg-destructive text-destructive-foreground rounded"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          onClick={() => setShowCancelConfirmation(true)}
                          className="w-full px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm"
                        >
                          Cancel Subscription
                        </button>
                      )}
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-sm text-foreground/70 mb-4">
                        No active subscription. Start one to begin supporting creators.
                      </div>

                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {[10, 20, 50, 100, 'custom'].map((amount) => {
                          const isSelected = selectedAmount === amount;
                          console.log(`Rendering amount: ${amount}, isSelected: ${isSelected}, selectedAmount: ${selectedAmount}`);

                          return (
                            <button
                              key={`${typeof amount === 'number' ? amount.toString() : amount}`}
                              onClick={() => {
                                console.log(`Selecting amount: ${amount}, current: ${selectedAmount}`);
                                if (amount === 'custom') {
                                  setShowCustomModal(true);
                                } else if (typeof amount === 'number') {
                                  setSelectedAmount(amount);
                                }
                              }}
                              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                isSelected
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-secondary hover:bg-secondary/80 text-foreground'
                              }`}
                            >
                              {amount === 'custom'
                                ? (selectedAmount === 'custom' && customAmount
                                  ? `$${customAmount}`
                                  : 'Custom')
                                : `$${amount}`}
                            </button>
                          );
                        })}
                      </div>

                      {showCustomModal && (
                        <div className="p-3 bg-muted rounded-md mb-3">
                          <label className="block text-sm font-medium mb-2">Custom amount ($)</label>
                          <div className="flex space-x-2">
                            <input
                              type="number"
                              value={customAmount}
                              onChange={(e) => setCustomAmount(e.target.value)}
                              className="w-full px-3 py-2 bg-background border border-input rounded-md"
                              placeholder="Enter amount"
                              min="1"
                              step="0.01"
                              autoFocus
                            />
                            <button
                              onClick={() => setShowCustomModal(false)}
                              className="px-3 py-2 bg-secondary text-secondary-foreground rounded-md text-sm"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => {
                                if (Number(customAmount) > 0) {
                                  console.log(`Setting custom amount: ${customAmount}`);
                                  setSelectedAmount('custom');
                                  setShowCustomModal(false);
                                }
                              }}
                              className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm"
                            >
                              Set
                            </button>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={handleActivateSubscription}
                        className="w-full px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm"
                      >
                        Start Subscription
                      </button>
                    </div>
                  )}
                </div>
              </section>

              {/* Increment Amount Section */}
              <section className="mb-8">
                <div className="space-y-4 p-4 bg-background/40 rounded-lg border border-border/40">
                  <div>
                    <h4 className="text-sm font-medium mb-2">Increment Amount</h4>
                    <p className="text-xs text-muted-foreground mb-4">
                      Choose how much to increment or decrement each pledge when using the plus and minus buttons.
                    </p>

                    <div className="grid grid-cols-4 gap-2 mb-4">
                      {[0.01, 0.1, 1.0, 10.0].map((amount) => {
                        const isSelected = Math.abs(globalIncrement - amount) < 0.001;
                        console.log(`Rendering increment: ${amount}, isSelected: ${isSelected}, globalIncrement: ${globalIncrement}`);

                        return (
                          <button
                            key={amount}
                            onClick={() => {
                              console.log(`Setting increment to: ${amount}, current: ${globalIncrement}`);
                              onIncrementChange(amount);
                            }}
                            className={`px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                              isSelected
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-secondary hover:bg-secondary/80 text-foreground'
                            }`}
                          >
                            {amount}
                          </button>
                        );
                      })}
                    </div>

                    <button
                      onClick={() => {
                        console.log("Opening custom increment modal");
                        setShowCustomIncrementModal(true);
                      }}
                      className={`w-full px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        customIncrementAmount
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary hover:bg-secondary/80 text-foreground'
                      }`}
                    >
                      {customIncrementAmount
                        ? `Custom: ${parseFloat(customIncrementAmount).toFixed(2)}`
                        : 'Custom Amount'}
                    </button>

                    {showCustomIncrementModal && (
                      <div className="p-3 bg-muted rounded-md mt-4">
                        <label className="block text-sm font-medium mb-2">Custom increment</label>
                        <div className="flex space-x-2">
                          <input
                            type="number"
                            value={customIncrementValue}
                            onChange={(e) => setCustomIncrementValue(e.target.value)}
                            className="w-full px-3 py-2 bg-background border border-input rounded-md"
                            placeholder="Enter amount"
                            min="0.01"
                            step="0.01"
                          />
                          <button
                            onClick={() => setShowCustomIncrementModal(false)}
                            className="px-3 py-2 bg-secondary text-secondary-foreground rounded-md text-sm"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={handleSaveCustomIncrement}
                            className="px-3 py-2 bg-primary text-primary-foreground rounded-md text-sm"
                          >
                            Set
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Pledges Section */}
              <section className="mb-8">
                <div>
                  <SpendingOverview total={totalPledgedAmount} max={subscription?.amount || 0} />
                </div>

                <div className="space-y-4 mt-6">
                  {pledges.length > 0 ? (
                    <>
                      <div className="pb-4 border-b border-border/70">
                        <div className="flex justify-between items-center mb-2">
                          <div className="text-lg font-semibold">My Pledges</div>
                          <button
                            onClick={handleSortToggle}
                            className={`flex items-center text-sm px-2 py-1 rounded-md transition-colors ${
                              needsSort
                                ? 'bg-primary/20 text-primary hover:bg-primary/30'
                                : 'text-primary hover:bg-primary/10'
                            }`}
                          >
                            {needsSort ? 'Click to sort' : 'Sort'}
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="16"
                              height="16"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className={`ml-1 transition-transform duration-300 ${sortDirection === 'asc' ? 'rotate-180' : ''}`}
                            >
                              <path d="m6 9 6 6 6-6"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                      {pledges.map(pledge => (
                        <div
                          key={pledge.id}
                          className="bg-background/40 hover:bg-background/60 p-3 rounded-lg border-theme-light hover-border-medium transition-all"
                        >
                          <TokenAllocationBar
                            value={pledge.amount}
                            max={subscription?.amount || 0}
                            onChange={() => {}}
                            disabled={false}
                            pledges={[pledge]}
                            subscriptionAmount={subscription?.amount || 0}
                            onPledgeChange={(id, change) => onPledgeAmountChange(id, change)}
                            onPledgeCustomAmount={onPledgeCustomAmount}
                            onDeletePledge={onDeletePledge}
                            showTitle={true}
                            showRemoveButton={true}
                            className=""
                          />
                        </div>
                      ))}
                    </>
                  ) : (
                    <div className="text-sm text-foreground/70 text-center py-4 bg-background/40 p-4 rounded-lg border border-border/30">
                      No pledges yet. Visit pages to make a pledge and support creators.
                    </div>
                  )}
                </div>
              </section>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertState.isOpen}
        onClose={closeAlert}
        title={alertState.title}
        message={alertState.message}
        buttonText={alertState.buttonText}
        variant={alertState.variant}
        icon={alertState.icon}
      />
    </>
  );
};

export default AccountDrawer;