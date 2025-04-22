"use client";

import { useState, useEffect, useRef, Fragment } from 'react';
import { ChevronRight, ChevronLeft, Plus, Minus, Youtube, Instagram, Twitter, DollarSign, LogOut, Heart } from 'lucide-react';
import { SupporterIcon } from '../components/SupporterIcon';
import Stepper from '../components/Stepper';
import CompositionBar from '../components/CompositionBar.js';
import Checkout from '../components/Checkout';
import { useAuth } from '../providers/AuthProvider';
import {
  getUserSubscription,
  updateSubscription,
  getUserPledges,
  cancelSubscription,
  getPledge,
  updatePledge,
  createPledge
} from '../firebase/subscription';
import { getDocById } from '../firebase/database';
import { loadStripe } from '@stripe/stripe-js';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { addUsername, updateEmail as updateFirebaseEmail, logoutUser } from '../firebase/auth';
import { db } from '../firebase/database';
import AccountDrawer from '../components/AccountDrawer';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import * as RadioGroup from '@radix-ui/react-radio-group';
import PaymentModal from '../components/PaymentModal';
import SubscriptionStatusCard from '../components/SubscriptionStatusCard';
import { Alert, AlertDescription, AlertTitle } from "../components/ui/alert";
import { Button } from "../components/ui/button";
import { AlertCircle } from "lucide-react";
import { socialLinks } from '../config/social-links';

interface ExpandedSections {
  profile: boolean;
  subscription: boolean;
  stepper: boolean;
  pledges: boolean;
}

interface Pledge {
  id: string;
  pageId: string;
  title: string;
  amount: number;
  createdAt: any; // Firebase Timestamp
  updatedAt: any; // Firebase Timestamp
}

interface Subscription {
  id: string;
  amount: number;
  status: string;
  billingCycleEnd: string;
  pledgedAmount: number;
  stripeCustomerId: string;
  stripePriceId: string;
  stripeSubscriptionId: string | null;
  createdAt: any; // Firebase Timestamp
  updatedAt: any; // Firebase Timestamp
}

const SpendingOverview = ({ total, max }: { total: number, max: number }) => {
  const percentage = max > 0 ? Math.min(100, (total / max) * 100) : 0;
  const isExceeded = total > max;

  return (
    <div className="mt-4 p-4 bg-background rounded-lg border border-border shadow-sm">
      <div className="flex justify-between mb-2">
        <h3 className="text-base font-medium">Current Spending</h3>
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

export default function AccountPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [globalIncrement, setGlobalIncrement] = useState(0.1);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [nextPaymentDate, setNextPaymentDate] = useState<Date | null>(null);
  const [timeUntilPayment, setTimeUntilPayment] = useState('');
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [sortedPledges, setSortedPledges] = useState<Pledge[]>([]);
  const [customIncrementAmount, setCustomIncrementAmount] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [sortButtonDisabled, setSortButtonDisabled] = useState(true);
  const [pendingSubscriptionAmount, setPendingSubscriptionAmount] = useState<number | null>(null);
  const [selectedIncrementButton, setSelectedIncrementButton] = useState<number>(0.1);
  const [selectedSubscriptionButton, setSelectedSubscriptionButton] = useState<number | string | null>(20);
  const [isCustomSubscription, setIsCustomSubscription] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [clientSecret, setClientSecret] = useState('');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [customSubscriptionAmount, setCustomSubscriptionAmount] = useState('');
  const [isSubscriptionActive, setIsSubscriptionActive] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Check if pledges order matches current sort order
  useEffect(() => {
    if (pledges.length <= 1) {
      setSortButtonDisabled(true);
      return;
    }

    setSortButtonDisabled(false);
  }, [sortedPledges, sortOrder, pledges.length]);

  useEffect(() => {
    if (user) {
      console.log('Loading user data for user:', user.uid);
      loadUserData();
    } else {
      router.push('/');
    }
  }, [user, router]);

  // Add effect to reload data when refresh parameter is present
  useEffect(() => {
    const shouldRefresh = searchParams.get('refresh') === 'true';
    if (shouldRefresh && user) {
      console.log('Refresh parameter detected, reloading user data');
      loadUserData();

      // Clear the refresh parameter from the URL without full page reload
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, [searchParams, user]);

  useEffect(() => {
    if (pledges.length > 0) {
      // Just set the sortedPledges to the current pledges without sorting
      // This prevents automatic resorting when pledge amounts change
      setSortedPledges(prevSorted => {
        // If there's no previous sorted state or the number of pledges changed,
        // initialize with the current pledges array
        if (!prevSorted.length || prevSorted.length !== pledges.length) {
          return [...pledges];
        }

        // Otherwise, maintain the current order but update the pledge amounts
        return prevSorted.map(sortedPledge => {
          // Find the corresponding pledge with updated amount
          const updatedPledge = pledges.find(p => p.id === sortedPledge.id);
          if (updatedPledge) {
            // Update the amount but keep the position
            return { ...sortedPledge, amount: updatedPledge.amount };
          }
          return sortedPledge;
        });
      });
    }
  }, [pledges]);

  useEffect(() => {
    if (nextPaymentDate) {
      // Update immediately
      updateTimeUntilPayment();

      // Then set up interval for continuous updates
      const timer = setInterval(updateTimeUntilPayment, 1000);
      return () => clearInterval(timer);
    }
  }, [nextPaymentDate]);

  // When loading for the first time, set the sort order to desc
  useEffect(() => {
    if (!sortOrder) {
      setSortOrder('desc');
    }
  }, [sortOrder]);

  const fetchPaymentHistory = async (userId) => {
    if (!userId) return;

    try {
      setIsLoadingHistory(true);

      // Call the API to get payment history
      const response = await fetch('/api/payment-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch payment history');
      }

      const data = await response.json();
      setPaymentHistory(data.payments || []);
    } catch (error) {
      console.error('Error fetching payment history:', error);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const loadUserData = async () => {
    if (!user) return;

    try {
      // Load subscription data
      const userSubscription = await getUserSubscription(user.uid);
      console.log('User subscription data:', userSubscription);
      if (userSubscription) {
        const subscription = userSubscription as unknown as Subscription;
        setSubscription(subscription);
        console.log('Setting subscription with status:', subscription.status);

        if (subscription.billingCycleEnd) {
          setNextPaymentDate(new Date(subscription.billingCycleEnd));
          updateTimeUntilPayment();
        }

        // Fetch payment history if subscription is active
        if (subscription.status === 'active') {
          fetchPaymentHistory(user.uid);
        }

        // Set the selected subscription button based on the subscription amount
        if ([10, 20, 50, 100].includes(subscription.amount)) {
          console.log(`Setting selectedSubscriptionButton to ${subscription.amount} (standard)`);
          setSelectedSubscriptionButton(subscription.amount);
          setIsCustomSubscription(false);
        } else {
          console.log(`Setting selectedSubscriptionButton to ${subscription.amount} (custom)`);
          setSelectedSubscriptionButton(subscription.amount);
          setIsCustomSubscription(true);
        }

        // Set subscription active status
        setIsSubscriptionActive(subscription.status === 'active');
      } else {
        // Default to $20 if no subscription
        console.log("No subscription found, defaulting to $20");
        setSelectedSubscriptionButton(20);
        setIsCustomSubscription(false);
      }

      // Load pledges
      const userPledges = await getUserPledges(user.uid);
      const pledgesWithTitles = await Promise.all(userPledges.map(async pledge => {
        const pageDoc = await getDocById("pages", (pledge as unknown as Pledge).pageId);
        return {
          id: pledge.id,
          pageId: (pledge as unknown as Pledge).pageId,
          title: pageDoc?.data()?.title || 'Untitled Page',
          amount: (pledge as unknown as Pledge).amount,
          createdAt: (pledge as unknown as Pledge).createdAt,
          updatedAt: (pledge as unknown as Pledge).updatedAt
        };
      }));
      setPledges(pledgesWithTitles);
      setSortedPledges([...pledgesWithTitles]);

      // Load user profile data
      try {
        const userDoc = await getDocById("users", user.uid);
        if (userDoc && userDoc.exists()) {
          const userData = userDoc.data();

          // Set default increment if it exists
          if (userData.defaultIncrement) {
            const incrementValue = userData.defaultIncrement;
            setGlobalIncrement(incrementValue);

            // Explicitly set the selected increment button
            if ([0.01, 0.1, 1, 10].includes(incrementValue)) {
              setSelectedIncrementButton(incrementValue);
              setCustomIncrementAmount('');
            } else {
              setSelectedIncrementButton(incrementValue);
              setCustomIncrementAmount(incrementValue.toString());
            }
          } else {
            // Default to 0.1 increment
            setGlobalIncrement(0.1);
            setSelectedIncrementButton(0.1);
          }

          // Set username from userData if available
          if (userData.username) {
            setUsername(userData.username);
          } else {
            setUsername(user.displayName || '');
          }
        }
      } catch (err) {
        console.error("Error loading user profile:", err);
      }

      // Set user email
      setEmail(user.email || '');
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const updateTimeUntilPayment = () => {
    if (!nextPaymentDate) return;

    const now = new Date();
    const diff = nextPaymentDate.getTime() - now.getTime();

    if (diff <= 0) {
      setTimeUntilPayment('Payment due now');
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    setTimeUntilPayment(`${days}d ${hours}h ${minutes}m ${seconds}s`);
  };

  const handleActivateSubscription = async (amount: number | string) => {
    if (!user) return;

    let finalAmount: number;

    if (typeof amount === 'string') {
      // If it's custom input from the input field
      const parsed = parseFloat(amount);
      if (isNaN(parsed) || parsed <= 0) {
        alert('Please enter a valid subscription amount');
        return;
      }
      finalAmount = parsed;
    } else {
      // If it's from radio buttons
      finalAmount = amount;
    }

    // Update the selected button state immediately for UI feedback
    setSelectedSubscriptionButton(finalAmount);

    // If this is a custom amount, set the custom flag
    if (![10, 20, 50, 100].includes(finalAmount)) {
      setIsCustomSubscription(true);
    } else {
      setIsCustomSubscription(false);
    }

    try {
      // Create a temporary subscription object to show UI feedback while waiting for server
      const tempSubscription: Subscription = {
        ...subscription,
        id: subscription?.id || '',
        amount: finalAmount,
        status: 'pending',
        billingCycleEnd: subscription?.billingCycleEnd || '',
        pledgedAmount: subscription?.pledgedAmount || 0,
        stripeCustomerId: subscription?.stripeCustomerId || '',
        stripePriceId: subscription?.stripePriceId || '',
        stripeSubscriptionId: subscription?.stripeSubscriptionId || null,
        createdAt: subscription?.createdAt || null,
        updatedAt: subscription?.updatedAt || null
      };

      // Update local state immediately for UI feedback
      setSubscription(tempSubscription);

      console.log('Activating subscription with amount:', finalAmount);

      // Call the Stripe API endpoint to create a subscription
      const response = await fetch('/api/activate-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: finalAmount,
          userId: user.uid
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Server returned error:', response.status, errorData);
        throw new Error(`Failed to create subscription: ${response.status} ${response.statusText}`);
      }

      const { clientSecret, subscriptionId } = await response.json();
      console.log('Subscription created successfully:', subscriptionId);

      // Store client secret and amount for the payment modal
      setClientSecret(clientSecret);
      setPaymentAmount(finalAmount);

      // Open the payment modal
      setPaymentModalOpen(true);
    } catch (error) {
      console.error('Error activating subscription:', error);
      alert(`Subscription activation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // Reset subscription state on error
      setSubscription(subscription);
    }
  };

  const handlePaymentSuccess = () => {
    // Close the payment modal
    setPaymentModalOpen(false);

    // Update subscription status
    setIsSubscriptionActive(true);

    // Reload user data to reflect changes from server
    loadUserData();
  };

  const handlePaymentModalClose = () => {
    setPaymentModalOpen(false);

    // Reset subscription state on cancel
    setSubscription(subscription);
  };

  const handleUsernameChange = async (newUsername: string) => {
    if (!user || !newUsername) return;

    try {
      await addUsername(user.uid, newUsername);
      setUsername(newUsername);
    } catch (error) {
      console.error('Error updating username:', error);
      alert('Failed to update username. Please try again.');
    }
  };

  const handleEmailChange = async () => {
    if (!user) return;

    const newEmail = prompt("Enter new email address:", email);
    if (!newEmail) return;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      alert('Please enter a valid email address.');
      return;
    }

    setEmailError('');

    try {
      // Update email in Firebase Authentication
      await updateFirebaseEmail(user, newEmail);

      // Update email in state
      setEmail(newEmail);

      alert('Email updated successfully!');
    } catch (error) {
      console.error('Error updating email:', error);

      // Handle specific Firebase errors
      if (error.code === 'auth/requires-recent-login') {
        setEmailError('For security reasons, please log out and log back in before changing your email.');
        alert('For security reasons, please log out and log back in before changing your email.');
      } else if (error.code === 'auth/email-already-in-use') {
        setEmailError('This email is already in use by another account.');
        alert('This email is already in use by another account.');
      } else {
        setEmailError('Failed to update email. Please try again.');
        alert('Failed to update email. Please try again.');
      }
    }
  };

  const handleSaveCustomIncrement = (amount: string) => {
    const parsedAmount = parseFloat(amount);
    if (!isNaN(parsedAmount) && parsedAmount > 0) {
      // Update both the increment value and selected button
      const formattedAmount = Math.round(parsedAmount * 100) / 100; // Ensure 2 decimal places
      setGlobalIncrement(formattedAmount);
      setSelectedIncrementButton(formattedAmount);
      setCustomIncrementAmount(formattedAmount.toString());
      saveIncrementToUserSettings(formattedAmount);
    }
  };

  const saveIncrementToUserSettings = async (incrementValue: number) => {
    if (!user) return;

    try {
      const userDocRef = doc(db, "users", user.uid);
      await updateDoc(userDocRef, {
        defaultIncrement: incrementValue
      });
    } catch (error) {
      console.error('Error saving increment value:', error);
    }
  };

  const createPortalSession = async (userId) => {
    if (!userId) return;

    try {
      setLoading(true);

      // Call the create portal session API
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to create portal session');
      }

      // Redirect to the Stripe Customer Portal
      if (responseData.url) {
        window.location.href = responseData.url;
      } else {
        throw new Error('No portal URL returned from server');
      }
    } catch (error) {
      console.error('Error creating portal session:', error);
      alert('Failed to open subscription management portal: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user || !subscription?.stripeSubscriptionId) {
      alert('No active subscription found to cancel.');
      return;
    }

    try {
      // Show confirmation dialog
      if (!window.confirm('Are you sure you want to cancel your subscription? This will stop all future payments and remove your supporter badge.')) {
        return;
      }

      setLoading(true);

      // Call the cancel subscription API
      const response = await fetch('/api/cancel-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscriptionId: subscription.stripeSubscriptionId
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to cancel subscription');
      }

      if (!responseData.success) {
        throw new Error(responseData.message || 'Failed to cancel subscription');
      }

      // Update subscription status locally
      setIsSubscriptionActive(false);
      setSubscription({
        ...subscription,
        status: 'canceled'
      });

      // Show success message
      alert('Your subscription has been canceled successfully. Your supporter badge will be removed.');

      // Reload user data to reflect changes from server
      loadUserData();
    } catch (error) {
      console.error('Error canceling subscription:', error);
      alert('Failed to cancel subscription: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleIncrementChange = (value: number) => {
    console.log(`Changing increment to: ${value}, previous: ${globalIncrement}`);

    // Update the selected button state immediately for UI feedback
    setSelectedIncrementButton(value);

    // Update the global increment value
    setGlobalIncrement(value);

    // Clear custom increment amount if this is a default value
    if ([0.01, 0.1, 1.0, 10.0].includes(value)) {
      setCustomIncrementAmount('');
    }

    // Save to user settings
    saveIncrementToUserSettings(value);
  };

  const handlePledgeAmountChange = (pledgeId: string, change: number) => {
    console.log(`Changing pledge ${pledgeId} by ${change}`);

    // Find the pledge in the original pledges array
    const pledgeIndex = pledges.findIndex(p => p.id === pledgeId);
    if (pledgeIndex === -1) {
      console.error(`Pledge not found: ${pledgeId}`);
      return;
    }

    // Calculate the new amount
    const incrementValue = change * (globalIncrement || 1);
    let newAmount = Math.max(0, Number(pledges[pledgeIndex].amount || 0) + incrementValue);
    // Round to 2 decimal places
    newAmount = Math.round(newAmount * 100) / 100;

    // Update the original pledges array with the new amount
    const updatedPledges = [...pledges];
    updatedPledges[pledgeIndex] = {
      ...updatedPledges[pledgeIndex],
      amount: newAmount
    };

    // Set the updated pledges
    setPledges(updatedPledges);

    // Also update the sortedPledges for the specific pledge without resorting
    setSortedPledges(prevSorted => {
      return prevSorted.map(p => {
        if (p.id === pledgeId) {
          return { ...p, amount: newAmount };
        }
        return p;
      });
    });

    // Save changes to the database
    saveUserPledges(updatedPledges);
  };

  const handlePledgeCustomAmount = (pledgeId: string) => {
    // For now, just a placeholder - actual implementation would open a modal
    console.log(`Custom amount for pledge: ${pledgeId}`);
  };

  const handleDeletePledge = async (pledgeId: string) => {
    // Check for special case command IDs
    if (pledgeId.startsWith('sort-')) {
      // This is a sort command
      const sortDirection = pledgeId.replace('sort-', '') as 'asc' | 'desc';
      console.log(`Sorting pledges ${sortDirection}`);

      // Set the sort order
      setSortOrder(sortDirection);

      // Sort the pledges according to the direction
      const sorted = [...sortedPledges].sort((a, b) =>
        sortDirection === 'desc' ? b.amount - a.amount : a.amount - b.amount
      );

      setSortedPledges(sorted);
      setSortButtonDisabled(true);
      return;
    }

    // Check for refresh-data special case
    if (pledgeId === 'refresh-data') {
      console.log('Refresh data command received');
      loadUserData();
      return;
    }

    // Handle actual pledge deletion
    if (!user) return;

    if (window.confirm('Are you sure you want to remove this pledge?')) {
      const updatedPledges = pledges.filter(p => p.id !== pledgeId);
      setPledges(updatedPledges);

      // Also update sortedPledges by removing the deleted pledge
      setSortedPledges(prevSorted => prevSorted.filter(p => p.id !== pledgeId));

      saveUserPledges(updatedPledges);
    }
  };

  const saveUserPledges = async (updatedPledges: Pledge[]) => {
    if (!user) return;

    try {
      // Update each pledge in Firestore
      for (const pledge of updatedPledges) {
        try {
          await updatePledge(user.uid, pledge.pageId, pledge.amount);
        } catch (error) {
          console.error(`Error saving pledge ${pledge.id}:`, error);
        }
      }

      // Update subscription's pledgedAmount if needed
      if (subscription) {
        const totalPledged = updatedPledges.reduce((total, pledge) => total + Number(pledge.amount), 0);

        await updateSubscription(user.uid, {
          pledgedAmount: totalPledged
        });
      }
    } catch (error) {
      console.error("Error saving pledges:", error);
    }
  };

  // Function to check if pledges are in the expected order based on current sort direction
  const arePledgesInOrder = () => {
    if (pledges.length <= 1) return true;

    return sortedPledges.every((pledge, index) => {
      if (index === 0) return true;

      const prevPledge = sortedPledges[index - 1];
      return sortOrder === 'desc'
        ? prevPledge.amount >= pledge.amount
        : prevPledge.amount <= pledge.amount;
    });
  };

  // Check if pledges need to be sorted
  const needsSort = !arePledgesInOrder();

  // Handle manual sort button click with clear messaging
  const handleSortPledges = () => {
    // Toggle the sort order
    const newOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    console.log(`Toggling sort order from ${sortOrder} to ${newOrder}`);
    setSortOrder(newOrder);

    // Create a new sorted array based on the current pledges
    const sorted = [...sortedPledges].sort((a, b) =>
      newOrder === 'desc' ? b.amount - a.amount : a.amount - b.amount
    );

    // Update the sorted pledges with the new order
    setSortedPledges(sorted);
  };

  return (
    <div className="px-5 py-4 max-w-3xl mx-auto">
      <div className="flex items-center mb-6">
        <Button
          variant="outline"
          size="icon"
          onClick={() => router.push('/')}
          className="mr-4"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">Account Settings</h1>
      </div>

      {user && (
        <div className="space-y-8">
          {/* Profile Section */}
          <section>
            <h3 className="text-base font-medium mb-4">Profile</h3>
            <div className="space-y-4 bg-background rounded-lg border border-border p-4">
              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1">Username</label>
                <div className="flex justify-between items-center">
                  <p className="text-foreground">{username || 'No username set'}</p>
                  <button
                    onClick={() => {
                      const newUsername = prompt("Enter new username:", username);
                      if (newUsername) handleUsernameChange(newUsername);
                    }}
                    className="text-sm text-foreground/60 hover:text-foreground"
                  >
                    Edit
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground/80 mb-1">Email</label>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-foreground">{email || 'No email set'}</p>
                    {emailError && <p className="text-xs text-red-500 mt-1">{emailError}</p>}
                  </div>
                  <button
                    onClick={handleEmailChange}
                    className="text-sm text-foreground/60 hover:text-foreground"
                  >
                    Edit
                  </button>
                </div>
              </div>

              <div className="pt-4 mt-4 border-t border-border">
                <Button
                  variant="destructive"
                  className="w-full flex items-center justify-center gap-2"
                  onClick={async () => {
                    if (confirm('Are you sure you want to log out?')) {
                      // Pass false to ensure we clear the previousUserSession
                      await logoutUser(false);
                      router.push('/');
                    }
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </Button>
              </div>
            </div>
          </section>

          {/* Subscription Management Section */}
          <section>
            <h3 className="text-base font-medium mb-4">Subscription</h3>
            {console.log('Rendering subscription section with:', subscription)}
            {subscription && (subscription.status === 'active' || subscription.status === 'trialing') ? (
              <div className="bg-card rounded-lg border border-border p-4 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="h-5 w-5">
                      <SupporterIcon
                        tier={subscription.tier}
                        status={subscription.status}
                        size="lg"
                      />
                    </div>
                    <div>
                      <p className="font-medium">
                        {subscription.tier ? (
                          subscription.tier.startsWith('tier') ?
                            `Tier ${subscription.tier.slice(4)} Supporter` :
                            subscription.tier === 'bronze' ? 'Tier 1 Supporter' :
                            subscription.tier === 'silver' ? 'Tier 2 Supporter' :
                            subscription.tier === 'gold' ? 'Tier 3 Supporter' :
                            subscription.tier === 'diamond' ? 'Tier 4 Supporter' :
                            `${subscription.tier.charAt(0).toUpperCase() + subscription.tier.slice(1)} Supporter`
                        ) : 'Supporter'}
                      </p>
                      <div className="flex flex-col gap-1">
                        <p className="text-sm text-muted-foreground">
                          ${subscription.amount}/month - Supporting WeWrite development
                        </p>
                        <p className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 inline-block w-fit">
                          {subscription.status === 'active' ? 'Active' : subscription.status === 'trialing' ? 'Trial' : subscription.status}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    {nextPaymentDate && (
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground">
                          Next payment: {nextPaymentDate.toLocaleDateString()}
                        </p>
                        <p className="text-xs font-mono text-primary">
                          {timeUntilPayment}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                {/* Payment History */}
                <div className="mt-4 border-t border-border pt-4">
                  <h4 className="text-sm font-medium mb-2">Payment History</h4>
                  {isLoadingHistory ? (
                    <div className="py-4 flex justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary"></div>
                    </div>
                  ) : paymentHistory.length > 0 ? (
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {paymentHistory.map((payment, index) => (
                        <div key={index} className="flex justify-between items-center py-2 border-b border-border/40 last:border-0">
                          <div>
                            <p className="text-sm font-medium">${payment.amount.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground">{new Date(payment.created * 1000).toLocaleDateString()}</p>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full ${payment.status === 'succeeded' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100'}`}>
                            {payment.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground py-2">No payment history available</p>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col gap-3 mt-4">
                  <Button
                    variant="outline"
                    onClick={() => createPortalSession(user.uid)}
                    className="w-full justify-center border-border hover:bg-background"
                    disabled={loading}
                  >
                    {loading ? 'Loading...' : 'Manage Subscription'}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleCancelSubscription}
                    className="w-full justify-center"
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : 'Cancel Subscription'}
                  </Button>
                </div>
              </div>
            ) : (
              <Alert className="bg-card border-border">
                <DollarSign className="h-4 w-4 text-primary" />
                <AlertTitle>Become a Supporter</AlertTitle>
                <AlertDescription>
                  <p className="mb-4">Support WeWrite's development and get exclusive badges on your profile.</p>
                  <Button asChild className="w-full">
                    <Link href="/support" className="flex items-center gap-2">
                      <Heart className="h-4 w-4" />
                      Become a Supporter
                    </Link>
                  </Button>
                </AlertDescription>
              </Alert>
            )}
          </section>

          {/* Social Media Section */}
          <section>
            <h3 className="text-base font-medium mb-4">Follow Us</h3>
            <div className="bg-background rounded-lg border border-border p-4">
              <p className="text-sm text-foreground/80 mb-4">Follow us on social media for future updates and announcements.</p>
              <div className="flex flex-col gap-2 w-full">
                <Button
                  variant="outline"
                  asChild
                  className={`w-full justify-center bg-[#1DA1F2] hover:bg-[#1DA1F2]/90 text-white border-[#1DA1F2]`}
                >
                  <a
                    href={socialLinks.find(link => link.platform === 'twitter')?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Twitter className="h-4 w-4 text-white" />
                    <span>Follow on X (Twitter)</span>
                  </a>
                </Button>
                <Button
                  variant="outline"
                  asChild
                  className={`w-full justify-center bg-[#FF0000] hover:bg-[#FF0000]/90 text-white border-[#FF0000]`}
                >
                  <a
                    href={socialLinks.find(link => link.platform === 'youtube')?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Youtube className="h-4 w-4 text-white" />
                    <span>Subscribe on YouTube</span>
                  </a>
                </Button>
                <Button
                  variant="outline"
                  asChild
                  className={`w-full justify-center bg-gradient-to-r from-[#F58529] via-[#DD2A7B] to-[#8134AF] hover:opacity-90 text-white border-transparent`}
                >
                  <a
                    href={socialLinks.find(link => link.platform === 'instagram')?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2"
                  >
                    <Instagram className="h-4 w-4 text-white" />
                    <span>Follow on Instagram</span>
                  </a>
                </Button>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* Add Payment Modal */}
      <PaymentModal
        open={paymentModalOpen}
        clientSecret={clientSecret}
        amount={paymentAmount}
        onSuccess={handlePaymentSuccess}
        onClose={handlePaymentModalClose}
      />

      {/* Custom Increment Modal */}
      {showCustomModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-background rounded-lg p-6 w-[90%] max-w-md">
            <h3 className="text-lg font-medium mb-4">Custom Increment Amount</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enter a custom amount to increment or decrement pledges.
            </p>

            <div className="flex items-center mb-6">
              <span className="text-foreground mr-2">$</span>
              <input
                type="number"
                value={customIncrementAmount}
                onChange={(e) => setCustomIncrementAmount(e.target.value)}
                min="0.01"
                step="0.01"
                className="w-full p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 border border-input bg-background"
                autoFocus
              />
            </div>

            <div className="flex justify-end space-x-3">
              <Button
                onClick={() => setShowCustomModal(false)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (customIncrementAmount) {
                    handleSaveCustomIncrement(customIncrementAmount);
                    setShowCustomModal(false);
                  }
                }}
                disabled={!customIncrementAmount || isNaN(parseFloat(customIncrementAmount)) || parseFloat(customIncrementAmount) <= 0}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}