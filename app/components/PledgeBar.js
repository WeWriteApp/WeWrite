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
  const [visible, setVisible] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);

  const { id: pageId } = useParams();

  // Handle scroll events to hide/show the pledge bar
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = Math.abs(currentScrollY - lastScrollY);

      // Only respond to significant scroll movements (more than 5px)
      if (scrollDelta > 5) {
        // Show the bar when scrolling up, hide when scrolling down
        if (currentScrollY < lastScrollY) {
          // Scrolling up - show the bar
          setVisible(true);
          console.log('PledgeBar: Scrolling up, showing bar');
        } else if (currentScrollY > lastScrollY) {
          // Scrolling down - hide the bar
          setVisible(false);
          console.log('PledgeBar: Scrolling down, hiding bar');
        }
      }

      setLastScrollY(currentScrollY);
    };

    // Add spring animation effect
    const style = document.createElement('style');
    style.innerHTML = `
      .pledge-bar-spring {
        transition-timing-function: cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
      }
    `;
    document.head.appendChild(style);

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Initial check
    handleScroll();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      document.head.removeChild(style);
    };
  }, []);

  // Detect if we're on a page view
  useEffect(() => {
    // Check if we're on a page view with the new URL structure
    // The new structure is just /[id] for pages
    const isOnPageView = pathname && (
      // Match the old URL structure for backward compatibility
      pathname.includes('/pages/') ||
      // Match the new URL structure: /[id] (but not /u/ or /g/ paths)
      (pathname.match(/^\/[a-zA-Z0-9_-]+$/) &&
       !pathname.startsWith('/user/') &&
       !pathname.startsWith('/group/'))
    );

    console.log('PledgeBar: Checking if on page view:', { pathname, isOnPageView });
    setIsPageView(isOnPageView);

    // If not on a page view, set loading to false
    if (!isOnPageView) {
      setLoading(false);
    }
  }, [pathname]);

  // Define loadData function outside useEffect so it can be called from other functions
  const loadData = async () => {
    if (!user || !pageId) {
      setLoading(false);
      console.log('PledgeBar: No user or pageId, skipping data load', { user: !!user, pageId });
      return;
    }

    console.log('PledgeBar: Loading data for page', { pageId });
    setLoading(true);

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

  // Load user subscription and pledge data
  useEffect(() => {
    // Only load data if we're on a page view
    if (isPageView) {
      loadData();
    } else {
      console.log('PledgeBar: Not on a page view, skipping data load');
      setLoading(false);
    }
  }, [user, pageId, isPageView]);

  // Note: We're not including loadData in the dependency array because it would cause an infinite loop

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

    // Save the updated pledge to the database
    if (pageId && user) {
      const oldAmount = currentPledge.amount || 0;
      updatePledge(user.uid, pageId, newAmount, oldAmount)
        .then(() => {
          console.log('Pledge updated successfully');
        })
        .catch(error => {
          console.error('Error updating pledge:', error);
        });
    }
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

  // If not on a page view, don't render anything
  if (!isPageView) {
    return null;
  }

  // If this is the user's own page, show stats instead of pledge bar
  if (isOwnPage) {
    return (
      <div
        className={`fixed bottom-4 left-8 right-8 z-50 flex justify-center transition-all duration-300 pledge-bar-spring ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
        }`}
      >
        <div
          className="w-full max-w-md mx-auto bg-background dark:bg-background/30 backdrop-blur-md shadow-lg hover:shadow-xl transition-shadow rounded-xl cursor-pointer"
          onClick={() => setShowActivationModal(true)}
        >
          <div className="flex justify-around py-4 px-6">
            <div className="text-center">
              <p className="text-sm text-foreground/60">{pageStats.activeDonors}</p>
              <p className="text-xs text-foreground/40">Active Donors</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-foreground/60">${pageStats.monthlyIncome.toFixed(2)}/mo</p>
              <p className="text-xs text-foreground/40">Monthly Income</p>
            </div>

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
      <div className="w-full max-w-md mx-auto bg-background/80 shadow-lg rounded-lg backdrop-blur-md border-theme-light py-4 px-6">
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
      <div className="w-full max-w-md mx-auto bg-background/80 shadow-lg rounded-lg backdrop-blur-md border-theme-light py-4 px-6">
        <div className="animate-pulse flex justify-center">
          <div className="h-10 bg-foreground/10 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  const handlePledgeInteraction = (pledgeId, change) => {
    console.log("handlePledgeInteraction called", { isOwnPage, user, pledgeId, change });

    // Always show the activation modal for now, since the feature isn't fully implemented
    setShowActivationModal(true);
    return;
  };

  // Handle increment button click
  const handleIncrementAmount = () => {
    if (maxedOut) return;

    // Use the first pledge in the list (there should only be one)
    if (pledges.length > 0) {
      handlePledgeAmountChange(pledges[0].id, 1);
    } else if (pageId) {
      // Create a new pledge if none exists
      const newAmount = 1;
      createNewPledge(newAmount);
    }
  };

  // Handle decrement button click
  const handleDecrementAmount = () => {
    if (donateAmount <= 0) return;

    // Use the first pledge in the list (there should only be one)
    if (pledges.length > 0) {
      handlePledgeAmountChange(pledges[0].id, -1);
    }
  };

  // Handle setting a custom amount
  const handleSetCustomAmount = (amount) => {
    if (pledges.length > 0) {
      // Update pledges with the new amount
      const updatedPledges = pledges.map(p => ({ ...p, amount }));
      setPledges(updatedPledges);
      setDonateAmount(amount);
      setSelectedAmount(amount);
      setIsConfirmed(false);

      // Save the updated pledge to the database
      if (pageId && user) {
        const oldAmount = pledges[0].amount || 0;
        updatePledge(user.uid, pageId, amount, oldAmount)
          .then(() => {
            console.log('Pledge updated successfully');
          })
          .catch(error => {
            console.error('Error updating pledge:', error);
          });
      }
    } else if (pageId && user && amount > 0) {
      // Create a new pledge if none exists
      createNewPledge(amount);
    }
  };

  // Create a new pledge
  const createNewPledge = (amount) => {
    if (!pageId || !user || !subscription) return;

    // Check if the amount is within the available budget
    const totalPledged = subscription.pledgedAmount || 0;
    if (amount + totalPledged > subscription.amount) {
      setShowMaxedOutWarning(true);
      return;
    }

    // Create a new pledge
    createPledge(user.uid, pageId, amount)
      .then(() => {
        console.log('Pledge created successfully');
        // Refresh the pledges
        loadData();
      })
      .catch(error => {
        console.error('Error creating pledge:', error);
      });
  };

  // Helper functions for the pledge bar percentages
  const getSpentPercentage = () => {
    if (!subscription || subscription.amount === 0) return 0;

    const totalAmount = subscription.amount;
    const pledgedAmount = subscription.pledgedAmount || 0;
    const currentAmount = donateAmount || 0;
    const spentAmount = pledgedAmount - currentAmount;

    return (spentAmount / totalAmount) * 100;
  };

  const getCurrentPledgePercentage = () => {
    if (!subscription || subscription.amount === 0) return 0;

    const totalAmount = subscription.amount;
    const currentAmount = donateAmount || 0;

    return (currentAmount / totalAmount) * 100;
  };

  return (
    <>
      <div
        className={`fixed bottom-4 left-8 right-8 z-50 flex justify-center transition-all duration-300 pledge-bar-spring ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
        }`}
        onClick={() => setShowActivationModal(true)}
      >
        <div className="w-full max-w-md mx-auto cursor-pointer shadow-lg hover:shadow-xl transition-shadow rounded-xl overflow-hidden">
          {/* Custom Pledge Bar with Three-Color Background */}
          <div className="w-full bg-background dark:bg-background/30 backdrop-blur-md p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">${donateAmount.toFixed(2)}/mo</span>
              {maxedOut && (
                <span className="text-xs text-amber-500">(Budget limit reached)</span>
              )}
            </div>

            <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
              {/* Already spent section */}
              <div
                className="h-full bg-gray-400 dark:bg-gray-600 float-left"
                style={{ width: `${getSpentPercentage()}%` }}
              ></div>

              {/* Current pledge section */}
              <div
                className="h-full bg-blue-500 float-left"
                style={{ width: `${getCurrentPledgePercentage()}%` }}
              ></div>

              {/* Available budget is the remaining space */}
            </div>

            <div className="flex justify-between mt-2">
              <div className="flex items-center space-x-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDecrementAmount();
                  }}
                  disabled={donateAmount <= 0}
                  className={`p-1 rounded-full ${donateAmount <= 0 ? 'text-muted-foreground' : 'hover:bg-accent'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleIncrementAmount();
                  }}
                  disabled={maxedOut}
                  className={`p-1 rounded-full ${maxedOut ? 'text-muted-foreground' : 'hover:bg-accent'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCustomAmountModal(true);
                  }}
                  className="text-xs text-blue-500 hover:text-blue-600 ml-2"
                >
                  Custom
                </button>
              </div>

              <div className="text-xs text-muted-foreground">
                <span>Available: ${(subscription?.amount - (subscription?.pledgedAmount || 0) + donateAmount).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

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
    </>
  );
};

export default PledgeBar;
