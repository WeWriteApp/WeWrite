"use client";
import React, { useState, useEffect, useRef, useContext } from "react";
import { useParams, useRouter, usePathname } from "next/navigation";
import { AuthContext } from "../providers/AuthProvider";
import { getUserSubscription, getPledge, createPledge, updatePledge } from "../firebase/subscription";
import { getPageStats, getDocById } from "../firebase/database";
import Link from "next/link";
import CompositionBar from "./CompositionBar";
import { Button } from './ui/button';
import PledgeBarModal from './PledgeBarModal';

const PledgeBar = () => {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const pathname = usePathname();
  const [subscription, setSubscription] = useState(null);
  const [donateAmount, setDonateAmount] = useState(0);
  const [globalIncrement, setGlobalIncrement] = useState(1);
  const [isConfirmed, setIsConfirmed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [maxedOut, setMaxedOut] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showCustomAmountModal, setShowCustomAmountModal] = useState(false);
  const [customAmountValue, setCustomAmountValue] = useState('');
  const [isOwnPage, setIsOwnPage] = useState(false);
  const [showMaxedOutWarning, setShowMaxedOutWarning] = useState(false);
  const [pageStats, setPageStats] = useState({
    activeDonors: 0,
    monthlyIncome: 0,
    totalViews: 0
  });
  const [pageTitle, setPageTitle] = useState('');
  const [pledges, setPledges] = useState([]);
  const [isPageView, setIsPageView] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(0);
  const [showSocialModal, setShowSocialModal] = useState(false);

  const { id: pageId } = useParams();

  // Detect if we're on a page view
  useEffect(() => {
    setIsPageView(pathname && pathname.includes('/pages/'));
  }, [pathname]);

  // Load user subscription and pledge data
  useEffect(() => {
    const loadData = async () => {
      if (!user || !pageId) return;
      
      try {
        // Get the page to check its owner
        const pageDoc = await getDocById("pages", pageId);
        
        if (pageDoc && pageDoc.exists()) {
          setPageTitle(pageDoc.data().title || 'Untitled Page');
          
          // Set isOwnPage based on page ownership
          const isOwner = pageDoc.data().userId === user.uid;
          console.log("Checking page ownership:", { 
            pageUserId: pageDoc.data().userId, 
            currentUserId: user.uid,
            isOwner 
          });
          setIsOwnPage(isOwner);
          
          if (isOwner) {
            // Load page stats
            const stats = await getPageStats(pageId);
            setPageStats({
              activeDonors: stats?.activeDonors || 0,
              monthlyIncome: stats?.monthlyIncome || 0,
              totalViews: stats?.totalViews || 0
            });
          } else {
            // Get subscription data for donating
            const userSubscription = await getUserSubscription(user.uid);
            setSubscription(userSubscription);
            
            // Get pledge for this page if exists
            const pledge = await getPledge(user.uid, pageId);
            if (pledge) {
              setDonateAmount(pledge.amount);
              setSelectedAmount(pledge.amount);
              
              // Check if current pledge is already at subscription limit
              const usedAmount = userSubscription?.pledgedAmount || 0;
              const subscriptionAmount = userSubscription?.amount || 0;
              const availableAmount = subscriptionAmount - usedAmount + pledge.amount;
              
              if (pledge.amount >= availableAmount || usedAmount >= subscriptionAmount) {
                setMaxedOut(true);
              }
            } else {
              // Default to $0 if no existing pledge
              setDonateAmount(0);
              setSelectedAmount(0);
            }

            // Create a single pledge object for CompositionBar
            setPledges([{
              id: pageId,
              pageId: pageId,
              title: pageDoc.data().title || 'Untitled Page',
              amount: pledge?.amount || 0 // Default to 0 if no existing amount
            }]);
          }
        }
        
        setLoading(false);
      } catch (error) {
        console.error("Error loading data:", error);
        setLoading(false);
      }
    };
    
    loadData();
  }, [user, pageId]);

  // Set global increment (this could be loaded from user settings)
  useEffect(() => {
    // This could load the increment value from user settings
    setGlobalIncrement(1);
  }, []);

  // Track changes to pledges for debugging
  useEffect(() => {
    if (pledges.length > 0) {
      console.log("Pledges updated:", pledges.map(p => ({id: p.id, amount: p.amount})));
      console.log("Current donate amount:", donateAmount);
      
      // Ensure the amount is a valid number
      if (isNaN(pledges[0].amount) || pledges[0].amount === null) {
        const updatedPledges = pledges.map(p => ({
          ...p,
          amount: 0 // Default to 0 if amount is invalid
        }));
        setPledges(updatedPledges);
        setSelectedAmount(0);
      }
    }
  }, [pledges, donateAmount]);

  const handlePledgeAmountChange = (pledgeId, change) => {
    console.log("handlePledgeAmountChange called with pledgeId:", pledgeId, "change:", change, "globalIncrement:", globalIncrement);
    
    if (!user) {
      console.log("No user, redirecting to login");
      router.push('/auth/login');
      return;
    }
    
    // Check if subscription exists and is active
    console.log("Subscription status:", subscription?.status);
    if (!subscription) {
      console.log("No subscription, showing activation modal");
      setShowActivationModal(true);
      return;
    }
    
    if (subscription.status !== 'active') {
      console.log("Subscription not active, showing activation modal");
      setShowActivationModal(true);
      return;
    }
    
    // Find the current pledge
    const currentPledge = pledges.find(p => p.id === pledgeId);
    if (!currentPledge) {
      console.error("Pledge not found for ID:", pledgeId);
      return;
    }
    
    // Calculate the new amount
    const incrementValue = change * (globalIncrement || 1);
    let newAmount = Math.max(0, Number(currentPledge.amount || 0) + incrementValue);
    // Round to 2 decimal places
    newAmount = Math.round(newAmount * 100) / 100;
    
    console.log("Calculating new amount:", {
      currentAmount: currentPledge.amount,
      change,
      globalIncrement,
      incrementValue,
      newAmount
    });
    
    // Check subscription limits
    const totalPledged = subscription.pledgedAmount || 0;
    const currentAmount = Number(currentPledge.amount || 0);
    const otherPledgesAmount = totalPledged - currentAmount;
    
    // Don't allow amounts above available budget
    if (newAmount + otherPledgesAmount > subscription.amount) {
      console.log("Would exceed limit", {
        newAmount,
        otherPledgesAmount,
        subscriptionAmount: subscription.amount,
        total: newAmount + otherPledgesAmount
      });
      setShowMaxedOutWarning(true);
      return;
    }
    
    // Update pledges with the new amount
    setShowMaxedOutWarning(false);
    const updatedPledges = pledges.map(p => {
      if (p.id === pledgeId) {
        return { ...p, amount: newAmount };
      }
      return p;
    });
    
    console.log("Updating pledges", {
      before: pledges.map(p => ({id: p.id, amount: p.amount})),
      after: updatedPledges.map(p => ({id: p.id, amount: p.amount}))
    });
    
    setPledges(updatedPledges);
    setDonateAmount(newAmount);
    setSelectedAmount(newAmount);
    setIsConfirmed(false);
  };

  const handlePledgeCustomAmount = (pledgeId) => {
    const pledge = pledges.find(p => p.id === pledgeId);
    if (pledge) {
      setCustomAmountValue(pledge.amount.toString());
      setShowCustomAmountModal(true);
    }
  };

  const handleSaveCustomAmount = () => {
    const amount = parseFloat(customAmountValue);
    if (!isNaN(amount) && amount >= 0) {
      const totalPledged = subscription.pledgedAmount || 0;
      const currentAmount = pledges[0].amount;
      const otherPledgesAmount = totalPledged - currentAmount;
      
      // Don't allow amounts above available budget
      if (amount + otherPledgesAmount > subscription.amount) {
        setShowMaxedOutWarning(true);
        setShowCustomAmountModal(false);
        return;
      }
      
      const updatedPledges = pledges.map(p => {
        return { ...p, amount };
      });
      
      setPledges(updatedPledges);
      setDonateAmount(amount);
      setSelectedAmount(amount);
      setIsConfirmed(false);
    }
    setShowCustomAmountModal(false);
  };

  const handleActivateSubscription = () => {
    // Use router to navigate to account page with subscription amount
    if (selectedAmount > 0) {
      router.push(`/account?subscription=${selectedAmount}`);
    } else {
      console.error("No amount selected for subscription");
    }
  };
  
  // Save pledge changes with debounce
  useEffect(() => {
    if (!isConfirmed && user && pageId && !isOwnPage) {
      console.log("Scheduling pledge save with amount:", donateAmount);
      const saveTimeout = setTimeout(() => {
        savePledge();
      }, 1000);
      
      return () => clearTimeout(saveTimeout);
    }
  }, [donateAmount, isConfirmed, user, pageId, isOwnPage]);
  
  const savePledge = async () => {
    if (!user || !pageId) return;
    
    try {
      console.log(`Attempting to save pledge for page ${pageId} with amount ${donateAmount}`);
      const existingPledge = await getPledge(user.uid, pageId);
      
      if (existingPledge) {
        console.log(`Updating existing pledge with ID ${existingPledge.id}`);
        // Update existing pledge
        await updatePledge(user.uid, pageId, donateAmount, existingPledge.amount);
      } else {
        console.log(`Creating new pledge for page ${pageId}`);
        // Create new pledge
        await createPledge(user.uid, pageId, donateAmount);
      }
      
      // After successful save, reload subscription data to reflect new pledge amounts
      const updatedSubscription = await getUserSubscription(user.uid);
      if (updatedSubscription) {
        setSubscription(updatedSubscription);
      }
      
      setIsConfirmed(true);
    } catch (error) {
      console.error("Error saving pledge:", error);
      
      // If there was an error, try to recreate the pledge as a fallback
      if (donateAmount > 0) {
        try {
          console.log("Attempting to recreate pledge after error");
          await createPledge(user.uid, pageId, donateAmount);
          setIsConfirmed(true);
        } catch (secondError) {
          console.error("Failed to recreate pledge:", secondError);
        }
      }
    }
  };

  // If this is the user's own page, show stats instead of pledge bar
  if (isOwnPage) {
    return (
      <div 
        className="w-full max-w-md mx-auto bg-background/80 shadow-lg rounded-lg backdrop-blur-md border border-accent/20 py-4 px-6 cursor-pointer"
        onClick={() => setShowActivationModal(true)}
      >
        <div className="flex justify-around">
          <div className="text-center">
            <p className="text-sm text-foreground/60">{pageStats.activeDonors}</p>
            <p className="text-xs text-foreground/40">Active Donors</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-foreground/60">${pageStats.monthlyIncome.toFixed(2)}/mo</p>
            <p className="text-xs text-foreground/40">Monthly Income</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-foreground/60">{pageStats.totalViews}</p>
            <p className="text-xs text-foreground/40">Views</p>
          </div>
        </div>

        {/* Pledge Modal for self view */}
        <PledgeBarModal
          isOpen={showActivationModal}
          onClose={() => setShowActivationModal(false)}
          isSignedIn={!!user}
        />
      </div>
    );
  }

  // If user isn't logged in, show login button
  if (!user) {
    return (
      <div className="w-full max-w-md mx-auto bg-background/80 shadow-lg rounded-lg backdrop-blur-md border border-accent/20 py-4 px-6">
        <div className="text-center">
          <p className="text-foreground/70 mb-2">Login to support this creator</p>
          <Link href="/auth/login">
            <button className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium">
              Login
            </button>
          </Link>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="w-full max-w-md mx-auto bg-background/80 shadow-lg rounded-lg backdrop-blur-md border border-accent/20 py-4 px-6">
        <div className="animate-pulse flex justify-center">
          <div className="h-10 bg-foreground/10 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  const handlePledgeInteraction = (pledgeId, change) => {
    console.log("handlePledgeInteraction called", { isOwnPage, user, pledgeId, change });
    
    if (!user) {
      setShowActivationModal(true);
      return;
    }

    if (!subscription || subscription.status !== 'active') {
      setShowActivationModal(true);
      return;
    }

    // If we have an active subscription, handle the pledge change
    handlePledgeAmountChange(pledgeId, change);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pb-4">
      <div className="w-full max-w-md mx-auto bg-background/80 shadow-lg rounded-lg backdrop-blur-md border border-accent/20 py-4 px-6">
        {/* Main pledge bar */}
        <CompositionBar
          value={pledges[0]?.amount || 0}
          max={subscription?.amount || 100}
          onChange={() => {}}
          disabled={false}
          pledges={pledges}
          subscriptionAmount={subscription?.amount || 0}
          onPledgeChange={handlePledgeInteraction}
          onPledgeCustomAmount={handlePledgeCustomAmount}
          onDeletePledge={() => {}}
        />

        {/* Pledge Modal */}
        <PledgeBarModal
          isOpen={showActivationModal}
          onClose={() => setShowActivationModal(false)}
          isSignedIn={!!user}
        />
        
        {/* Custom Amount Modal - TODO: Convert to Radix Dialog */}
        {showCustomAmountModal && (
          <div>
            {/* Custom amount modal content */}
          </div>
        )}
      </div>
    </div>
  );
};

export default PledgeBar;
