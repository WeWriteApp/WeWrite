"use client";
import React, { useState, useEffect, useRef, useContext } from "react";
import { createPortal } from "react-dom";
import { useParams, useRouter, usePathname } from "next/navigation";
import { AuthContext } from "../providers/AuthProvider";
import { getUserSubscription, getPledge, createPledge, updatePledge, listenToUserPledges } from "../firebase/subscription";
import { getPageStats, getDocById } from "../firebase/database";
import Link from "next/link";
import CompositionBar from "./CompositionBar";
import { Button } from './ui/button';
import SubscriptionActivationModal from './SubscriptionActivationModal';
import SubscriptionComingSoonModal from './SubscriptionComingSoonModal';
import SupportUsModal from './SupportUsModal';
import { ChevronDown, ChevronUp, DollarSign, Plus, Minus } from 'lucide-react';
import '../styles/pledge-bar-animations.css';
import { useFeatureFlag } from '../utils/feature-flags';
import { useToast } from './ui/use-toast';
import { Slider } from './ui/slider';
import { Input } from './ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';

const PledgeBar = () => {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState(null);
  const [pledgeAmount, setPledgeAmount] = useState(0);
  const [currentPledge, setCurrentPledge] = useState(null);
  const [allPledges, setAllPledges] = useState([]);
  const [availableFunds, setAvailableFunds] = useState(0);
  const [isConfirmed, setIsConfirmed] = useState(true);
  const [loading, setLoading] = useState(true);
  const [maxedOut, setMaxedOut] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showRebalanceModal, setShowRebalanceModal] = useState(false);
  const [showSupportUsModal, setShowSupportUsModal] = useState(false);
  const isSubscriptionEnabled = useFeatureFlag('subscription_management', user?.email);
  const [pageData, setPageData] = useState(null);
  const [sliderValue, setSliderValue] = useState(0);
  const pageId = pathname.substring(1); // Remove the leading slash to get the page ID
  const [pageStats, setPageStats] = useState({
    totalPledged: 0,
    pledgeCount: 0,
    activeDonors: 0,
    monthlyIncome: 0,
    totalViews: 0
  });
  const [customAmountValue, setCustomAmountValue] = useState('');
  const [isOwnPage, setIsOwnPage] = useState(false);
  const [showMaxedOutWarning, setShowMaxedOutWarning] = useState(false);

  // Effect to check if subscription feature is enabled
  useEffect(() => {
    if (!isSubscriptionEnabled) {
      return;
    }

    // Only proceed if we have a valid page ID
    if (!pageId) {
      return;
    }

    // Fetch page data
    const fetchPageData = async () => {
      try {
        const page = await getDocById('pages', pageId);
        if (page) {
          setPageData(page);
          setPageTitle(page.title || 'Untitled');

          // Check if the current user is the page owner
          if (user && page.userId === user.uid) {
            setIsOwnPage(true);
          }
        }
      } catch (error) {
        console.error('Error fetching page data:', error);
      }
    };

    fetchPageData();

    // Fetch page stats
    const fetchPageStats = async () => {
      try {
        const stats = await getPageStats(pageId);
        if (stats) {
          setPageStats(stats);
        }
      } catch (error) {
        console.error('Error fetching page stats:', error);
      }
    };

    fetchPageStats();
  }, [pageId, user, isSubscriptionEnabled]);

  // Effect to fetch user subscription and pledges
  useEffect(() => {
    if (!isSubscriptionEnabled || !user || !pageId) {
      setLoading(false);
      return;
    }

    const fetchSubscriptionAndPledge = async () => {
      try {
        // Get user's subscription
        const userSubscription = await getUserSubscription(user.uid);
        setSubscription(userSubscription);

        if (userSubscription && userSubscription.status === 'active') {
          // Calculate available funds
          const totalAmount = userSubscription.amount || 0;
          const pledgedAmount = userSubscription.pledgedAmount || 0;
          const available = Math.max(0, totalAmount - pledgedAmount);
          setAvailableFunds(available);

          // Get current pledge for this page
          const pledge = await getPledge(user.uid, pageId);
          if (pledge) {
            setCurrentPledge(pledge);
            setPledgeAmount(pledge.amount);
            setSliderValue(pledge.amount);
          }

          // Set up listener for all user pledges
          const unsubscribe = listenToUserPledges(user.uid, (pledges) => {
            setAllPledges(pledges);
          });

          return () => unsubscribe();
        }
      } catch (error) {
        console.error('Error fetching subscription or pledge:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionAndPledge();
  }, [user, pageId, isSubscriptionEnabled]);

  // Handle pledge amount change via slider
  const handleSliderChange = (value) => {
    const newValue = value[0];
    setSliderValue(newValue);

    // Check if the new value exceeds available funds
    if (newValue > availableFunds + (currentPledge?.amount || 0)) {
      setShowMaxedOutWarning(true);
    } else {
      setShowMaxedOutWarning(false);
    }
  };

  // Handle pledge submission
  const handlePledgeSubmit = async () => {
    if (!user || !pageId || !subscription) {
      return;
    }

    try {
      setLoading(true);

      const newAmount = sliderValue;

      // Check if the amount exceeds available funds
      if (newAmount > availableFunds + (currentPledge?.amount || 0)) {
        setShowRebalanceModal(true);
        setLoading(false);
        return;
      }

      if (currentPledge) {
        // Update existing pledge
        await updatePledge(user.uid, pageId, newAmount, currentPledge.amount);
        toast({
          title: "Pledge updated",
          description: `Your pledge to "${pageTitle}" has been updated to $${newAmount.toFixed(2)}/month.`,
        });
      } else {
        // Create new pledge
        await createPledge(user.uid, pageId, newAmount);
        toast({
          title: "Pledge created",
          description: `You are now supporting "${pageTitle}" with $${newAmount.toFixed(2)}/month.`,
        });
      }

      // Update current pledge
      setCurrentPledge({
        ...currentPledge,
        amount: newAmount
      });

      // Update available funds
      const totalAmount = subscription.amount || 0;
      const pledgedAmount = subscription.pledgedAmount || 0;
      const available = Math.max(0, totalAmount - pledgedAmount);
      setAvailableFunds(available);

    } catch (error) {
      console.error('Error submitting pledge:', error);
      toast({
        title: "Error",
        description: "Failed to update your pledge. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle rebalancing pledges
  const handleRebalancePledges = async () => {
    setShowRebalanceModal(false);

    // For now, just show the subscription management page
    router.push('/account/subscription');
  };

  const [visible, setVisible] = useState(true);
  const [animateEntry, setAnimateEntry] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);

  // Scroll handling effect
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Hide when scrolling down, show when scrolling up
      if (currentScrollY > lastScrollY + 10) {
        setVisible(false);
      } else if (currentScrollY < lastScrollY - 10) {
        setVisible(true);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    // Animate entry after a short delay
    const timer = setTimeout(() => {
      setAnimateEntry(true);
    }, 500);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(timer);
    };
  }, [lastScrollY]);

  // Render the pledge bar
  if (!isSubscriptionEnabled) {
    return null;
  }

  // If user isn't logged in or doesn't have an active subscription, don't show the pledge bar
  if (!user || !subscription || subscription.status !== 'active') {
    return null;
  }

  // Don't show pledge bar on own pages
  if (isOwnPage) {
    return null;
  }

  // Scroll handling with throttling
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Hide when scrolling down, show when scrolling up
      if (currentScrollY > lastScrollY + 10) {
        setVisible(false);
      } else if (currentScrollY < lastScrollY - 10) {
        setVisible(true);
      }

      setLastScrollY(currentScrollY);
      ticking = false;
    };

    const onScroll = () => {
      if (!ticking) {
        // Use requestAnimationFrame to optimize scroll performance
        window.requestAnimationFrame(() => {
          handleScroll();
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
    };
  }, [lastScrollY]);

  return (
    <div
      data-pledge-bar
      className={`fixed bottom-12 left-8 right-8 z-50 flex justify-center transition-all duration-300 ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
      } ${animateEntry ? 'spring-and-pulse' : ''}`}
    >
      <div className="bg-card border border-border shadow-lg rounded-lg p-4 w-full max-w-xl">
        <div className="flex flex-col space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-medium">Support this page</h3>
            <div className="text-sm text-muted-foreground">
              Available: ${availableFunds.toFixed(2)}/month
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label htmlFor="pledge-amount" className="text-sm font-medium">
                  Pledge amount
                </label>
                <span className="text-sm font-medium">
                  ${sliderValue.toFixed(2)}/month
                </span>
              </div>

              <Slider
                id="pledge-amount"
                value={[sliderValue]}
                min={0}
                max={Math.max(50, subscription.amount)}
                step={0.5}
                onValueChange={handleSliderChange}
                className={showMaxedOutWarning ? "border-red-500" : ""}
              />

              {showMaxedOutWarning && (
                <p className="text-xs text-red-500 mt-1">
                  This exceeds your available funds. You'll need to adjust other pledges or increase your subscription.
                </p>
              )}
            </div>

            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSliderValue(0)}
                disabled={loading}
              >
                Reset
              </Button>
              <Button
                size="sm"
                onClick={handlePledgeSubmit}
                disabled={loading || (sliderValue === (currentPledge?.amount || 0))}
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center">
                    <DollarSign className="h-4 w-4 mr-1" />
                    {currentPledge ? "Update Pledge" : "Pledge Now"}
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Rebalance Modal */}
      <Dialog open={showRebalanceModal} onOpenChange={setShowRebalanceModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adjust Your Pledges</DialogTitle>
            <DialogDescription>
              You've reached your monthly pledge limit. You can adjust your existing pledges or increase your subscription.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <h4 className="text-sm font-medium mb-2">Your Current Pledges</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {allPledges.map(pledge => (
                <div key={pledge.id} className="flex justify-between items-center p-2 bg-muted rounded">
                  <span className="text-sm truncate max-w-[200px]">{pledge.title || pledge.pageId}</span>
                  <span className="text-sm font-medium">${pledge.amount.toFixed(2)}/mo</span>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setShowRebalanceModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleRebalancePledges}>
              Manage Pledges
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modals rendered at document level */}
      {/* When subscription is enabled, show the activation modal */}
      {typeof document !== 'undefined' && createPortal(
        <SubscriptionActivationModal
          isOpen={showActivationModal}
          onClose={() => setShowActivationModal(false)}
          isSignedIn={!!user}
        />,
        document.body
      )}

      {/* When subscription is disabled, show the Support Us modal */}
      {typeof document !== 'undefined' && createPortal(
        <SupportUsModal
          isOpen={showSupportUsModal || (!isSubscriptionEnabled && showActivationModal)}
          onClose={() => {
            setShowSupportUsModal(false);
            setShowActivationModal(false);
          }}
        />,
        document.body
      )}
    </div>
  );

  // Show mobile back to top button when scrolled down on mobile
  useEffect(() => {
    const handleScroll = () => {
      const isMobile = window.innerWidth < 640;
      setShowMobileBackToTop(isMobile && window.scrollY > 200);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const isDesktop = window.innerWidth >= 640;
      setShowDesktopBackToTop(isDesktop && window.scrollY > 200);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Detect if we're on a page view
  useEffect(() => {
    // Check if we're on a page view with the new URL structure
    // The new structure is just /[id] for pages
    const isOnPageView = pathname && (
      // Match the old URL structure for backward compatibility
      pathname.includes('/pages/') ||
      // Match the new URL structure: /[id] (but not /user/ or /g/ paths)
      (pathname.match(/^\/[a-zA-Z0-9_-]+$/) &&
       !pathname.startsWith('/user/') &&
       !pathname.startsWith('/g/'))
    );

    setIsPageView(isOnPageView);

    // If not on a page view, set loading to false
    if (!isOnPageView) {
      setLoading(false);
    }
  }, [pathname]);

  // Load user subscription and pledge data
  useEffect(() => {
    const loadData = async () => {
      if (!user || !pageId) {
        setLoading(false);
        return;
      }

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
    // Check if subscription feature is enabled
    if (!isSubscriptionEnabled) {
      setShowSupportUsModal(true);
      // Ensure we don't show the activation modal
      setShowActivationModal(false);
      return;
    }

    // Use router to navigate to account page with subscription amount
    if (selectedAmount > 0) {
      router.push(`/account?subscription=${selectedAmount}`);
    } else {
      console.error("No amount selected for subscription");
    }
  };

  // Save pledge changes with debounce
  useEffect(() => {
    if (!isConfirmed && user && pageId && !isOwnPage && isSubscriptionEnabled) {
      console.log("Scheduling pledge save with amount:", donateAmount);
      const saveTimeout = setTimeout(() => {
        savePledge();
      }, 1000);

      return () => clearTimeout(saveTimeout);
    }
  }, [donateAmount, isConfirmed, user, pageId, isOwnPage, isSubscriptionEnabled]);

  const savePledge = async () => {
    if (!user || !pageId) return;

    // Don't save pledges if subscription feature is disabled
    if (!isSubscriptionEnabled) {
      setShowSupportUsModal(true);
      // Ensure we don't show the activation modal
      setShowActivationModal(false);
      return;
    }

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
        data-pledge-bar
        className={`fixed bottom-12 left-8 right-8 z-50 flex justify-center transition-all duration-300 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
        } ${animateEntry ? 'spring-and-pulse' : ''}`}
        style={{ transform: visible ? 'translateY(0)' : 'translateY(20px)', opacity: visible ? 1 : 0 }}
      >
        <div
          className="w-full max-w-md mx-auto bg-background/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-shadow rounded-lg cursor-pointer"
          onClick={() => {
            // Show Support Us modal when feature flag is off
            if (!isSubscriptionEnabled) {
              setShowSupportUsModal(true);
              // Ensure we don't show the activation modal
              setShowActivationModal(false);
            } else {
              setShowActivationModal(true);
            }
          }}
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

        {/* Modals rendered at document level */}
        {/* When subscription is enabled, show the activation modal */}
        {typeof document !== 'undefined' && isSubscriptionEnabled && createPortal(
          <SubscriptionActivationModal
            isOpen={showActivationModal}
            onClose={() => setShowActivationModal(false)}
            isSignedIn={!!user}
          />,
          document.body
        )}

        {/* When subscription is disabled, show the Support Us modal */}
        {typeof document !== 'undefined' && createPortal(
          <SupportUsModal
            isOpen={showSupportUsModal || (!isSubscriptionEnabled && showActivationModal)}
            onClose={() => {
              setShowSupportUsModal(false);
              setShowActivationModal(false);
            }}
          />,
          document.body
        )}
      </div>
    );
  }

  // If user isn't logged in, show a regular pledge bar that opens login modal when clicked
  if (!user) {
    return (
      <div
        data-pledge-bar
        className={`fixed bottom-12 left-8 right-8 z-50 flex justify-center transition-all duration-300 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
        } ${animateEntry ? 'spring-and-pulse' : ''}`}
        style={{ transform: visible ? 'translateY(0)' : 'translateY(20px)', opacity: visible ? 1 : 0 }}
      >
        <CompositionBar
          value={0}
          max={100}
          onChange={() => {}}
          disabled={false}
          pledges={[{ id: 'placeholder', amount: 0 }]}
          subscriptionAmount={100}
          onPledgeChange={() => {
            // Show different modal based on subscription feature flag
            if (isSubscriptionEnabled) {
              setShowActivationModal(true);
            } else {
              setShowSupportUsModal(true);
              // Ensure we don't show the activation modal
              setShowActivationModal(false);
            }
          }}
          onPledgeCustomAmount={() => {
            // Show different modal based on subscription feature flag
            if (isSubscriptionEnabled) {
              setShowActivationModal(true);
            } else {
              setShowSupportUsModal(true);
              // Ensure we don't show the activation modal
              setShowActivationModal(false);
            }
          }}
          onDeletePledge={() => {}}
          className="w-full max-w-md mx-auto bg-background/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-shadow cursor-pointer"
        />

        {/* Modals rendered at document level */}
        {/* When subscription is enabled, show the activation modal */}
        {typeof document !== 'undefined' && isSubscriptionEnabled && createPortal(
          <SubscriptionActivationModal
            isOpen={showActivationModal}
            onClose={() => setShowActivationModal(false)}
            isSignedIn={!!user}
          />,
          document.body
        )}

        {/* When subscription is disabled, show the Support Us modal */}
        {typeof document !== 'undefined' && createPortal(
          <SupportUsModal
            isOpen={showSupportUsModal || (!isSubscriptionEnabled && showActivationModal)}
            onClose={() => {
              setShowSupportUsModal(false);
              setShowActivationModal(false);
            }}
          />,
          document.body
        )}
      </div>
    );
  }

  // Loading state - now hidden to prevent layout shift
  if (loading) {
    return null;
  }

  const handlePledgeInteraction = (pledgeId, change) => {
    console.log("handlePledgeInteraction called", { isOwnPage, user, pledgeId, change, isSubscriptionEnabled });

    // If subscription feature is disabled, show Support Us modal
    if (!isSubscriptionEnabled) {
      setShowSupportUsModal(true);
      // Ensure we don't show the activation modal
      setShowActivationModal(false);
      return;
    }

    // Only proceed with subscription-related logic if the feature is enabled
    // At this point, we know isSubscriptionEnabled is true
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
    <>
      <div
        className={`fixed bottom-12 left-8 right-8 z-50 flex flex-col items-center gap-2 transition-all duration-300 ${visible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'} ${animateEntry ? 'spring-and-pulse' : ''}`}
        style={{ transform: visible ? 'translateY(0)' : 'translateY(20px)', opacity: visible ? 1 : 0, background: 'none' }}
      >
        <div
          className="w-full max-w-md mx-auto cursor-pointer"
          onClick={() => {
            // Show Support Us modal when feature flag is off
            if (!isSubscriptionEnabled) {
              setShowSupportUsModal(true);
              // Ensure we don't show the activation modal
              setShowActivationModal(false);
            } else {
              setShowActivationModal(true);
            }
          }}
        >
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
            className="w-full bg-background/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-shadow"
          />
        </div>

        {showMoreButton && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground flex items-center gap-1 hover:bg-transparent hover:text-foreground transition-colors relative"
            onClick={scrollToMetadata}
            style={{ zIndex: 1 }}
          >
            <span>{isAtBottom ? 'Back to top' : 'More'}</span>
            {isAtBottom ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>

      {/* Pledge Modal - rendered at document level to ensure proper positioning */}
      {/* When subscription is enabled, show the activation modal */}
      {typeof document !== 'undefined' && isSubscriptionEnabled && createPortal(
        <SubscriptionActivationModal
          isOpen={showActivationModal}
          onClose={() => setShowActivationModal(false)}
          isSignedIn={!!user}
        />,
        document.body
      )}

      {/* Support Us Modal - rendered at document level */}
      {/* When subscription is disabled, show the Support Us modal */}
      {typeof document !== 'undefined' && createPortal(
        <SupportUsModal
          isOpen={showSupportUsModal || (!isSubscriptionEnabled && showActivationModal)}
          onClose={() => {
            setShowSupportUsModal(false);
            setShowActivationModal(false);
          }}
        />,
        document.body
      )}

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

// Set CSS variable for pledgebar background color based on theme
if (typeof window !== 'undefined') {
  document.documentElement.style.setProperty('--pledgebar-bg', window.matchMedia('(prefers-color-scheme: dark)').matches ? '#18181b' : '#fff');
}
