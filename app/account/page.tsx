"use client";

import { useState, useEffect, useRef } from 'react';
import { ChevronRight, Plus, Minus } from 'lucide-react';
import Stepper from '../components/Stepper';
import CompositionBar from '../components/CompositionBar.js';
import Checkout from '../components/Checkout';
import { useAuth } from '../providers/AuthProvider';
import { 
  getUserSubscription, 
  updateSubscription, 
  getUserPledges, 
  getPledge, 
  updatePledge,
  createPledge 
} from '../firebase/subscription';
import { getDocById } from '../firebase/database';
import { loadStripe } from '@stripe/stripe-js';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { addUsername } from '../firebase/auth';
import { db } from '../firebase/database';
import AccountDrawer from '../components/AccountDrawer';
import { useRouter, useSearchParams } from 'next/navigation';
import * as RadioGroup from '@radix-ui/react-radio-group';
import PaymentModal from '../components/PaymentModal';
import SubscriptionStatusCard from '../components/SubscriptionStatusCard';
import { Button } from '../ui/button';

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

  const loadUserData = async () => {
    if (!user) return;

    try {
      // Load subscription data
      const userSubscription = await getUserSubscription(user.uid);
      if (userSubscription) {
        const subscription = userSubscription as unknown as Subscription;
        setSubscription(subscription);
        
        if (subscription.billingCycleEnd) {
          setNextPaymentDate(new Date(subscription.billingCycleEnd));
          updateTimeUntilPayment();
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
    if (!user || !newUsername.trim()) return;
    
    try {
      await addUsername(user.uid, newUsername);
      setUsername(newUsername);
    } catch (error) {
      console.error('Error updating username:', error);
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

  const handleCancelSubscription = async () => {
    if (!user || !subscription?.stripeSubscriptionId) return;
    
    try {
      // Show confirmation dialog
      if (!window.confirm('Are you sure you want to cancel your subscription? This will stop all future payments.')) {
        return;
      }
      
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

      if (!response.ok) {
        throw new Error('Failed to cancel subscription');
      }

      // Update subscription status locally
      setIsSubscriptionActive(false);
      setSubscription({
        ...subscription,
        status: 'canceled'
      });
      
      // Show success message
      alert('Your subscription has been canceled successfully.');
      
      // Reload user data to reflect changes from server
      loadUserData();
    } catch (error) {
      console.error('Error canceling subscription:', error);
      alert('Failed to cancel subscription. Please try again.');
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
        <button 
          onClick={() => router.push('/')} 
          className="flex items-center text-sm mr-4 px-3 py-1.5 rounded-md bg-background/80 hover:bg-background/90 border border-border/50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Back
        </button>
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
                  <p className="text-foreground">{email || 'No email set'}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Subscription Section */}
          <section>
            <h3 className="text-base font-medium mb-4">Subscription</h3>
            {subscription?.status === 'active' ? (
              <div className="bg-background rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  <span className="font-medium">Active Subscription</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Monthly Amount</span>
                    <span className="font-medium">${subscription.amount}/mo</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Next Payment</span>
                    <span className="text-sm">{timeUntilPayment}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-background rounded-lg border border-orange-500/30 p-4 bg-orange-500/[0.15]">
                <div className="flex items-center gap-2 mb-3">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  <span className="font-medium text-orange-600">No Active Subscription</span>
                </div>
                <p className="text-sm text-orange-600/80 mb-4">Start a subscription to support creators and access premium features.</p>
                <button
                  onClick={() => setPaymentModalOpen(true)}
                  className="w-full py-2 px-4 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg transition-colors"
                >
                  Start Subscription
                </button>
              </div>
            )}
          </section>

          {/* Increment Amount Section */}
          <section>
            <h3 className="text-base font-medium mb-4">Increment Amount</h3>
            <div className="space-y-4 bg-background rounded-lg border border-border p-4">
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  Choose how much to increment or decrement each pledge when using the plus and minus buttons.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[0.1, 0.5, 1, 5].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => {
                        setSelectedIncrementButton(amount);
                        handleIncrementChange(amount);
                      }}
                      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        selectedIncrementButton === amount
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-secondary hover:bg-secondary/80 text-foreground'
                      }`}
                    >
                      ${amount}
                    </button>
                  ))}
                </div>
                
                <button
                  onClick={() => setShowCustomModal(true)}
                  className={`w-full mt-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                    customIncrementAmount 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-secondary hover:bg-secondary/80 text-foreground'
                  }`}
                >
                  {customIncrementAmount 
                    ? `Custom: $${parseFloat(customIncrementAmount).toFixed(2)}` 
                    : 'Custom Amount'}
                </button>
              </div>
            </div>
          </section>

          {/* Pledges Section */}
          <section className="mb-8">
            <div>
              <SpendingOverview total={pledges.reduce((total, pledge) => total + Number(pledge.amount), 0)} max={subscription?.amount || 0} />
            </div>

            <div className="space-y-4 mt-6">
              {pledges.length > 0 ? (
                <>
                  <div className="pb-4 border-b border-border/70">
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-lg font-semibold">My Pledges</div>
                      <button
                        onClick={handleSortPledges}
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
                          className={`ml-1 transition-transform duration-300 ${sortOrder === 'asc' ? 'rotate-180' : ''}`}
                        >
                          <path d="m6 9 6 6 6-6"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                  {sortedPledges.map(pledge => (
                    <div 
                      key={pledge.id} 
                      className="bg-background p-3 rounded-lg border border-border transition-all"
                    >
                      <CompositionBar
                        value={pledge.amount}
                        max={subscription?.amount || 0}
                        onChange={() => {}}
                        disabled={false}
                        pledges={[pledge]}
                        subscriptionAmount={subscription?.amount || 0}
                        onPledgeChange={(id, change) => handlePledgeAmountChange(id, change)}
                        onPledgeCustomAmount={handlePledgeCustomAmount}
                        onDeletePledge={handleDeletePledge}
                        showTitle={true}
                        showRemoveButton={true}
                      />
                    </div>
                  ))}
                </>
              ) : (
                <div className="text-sm text-foreground/70 text-center py-4 bg-background p-4 rounded-lg border border-border">
                  No pledges yet. Visit pages to make a pledge and support creators.
                </div>
              )}
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