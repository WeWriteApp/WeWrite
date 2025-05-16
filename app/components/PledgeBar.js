"use client";
import React, { useState, useEffect, useContext, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { AuthContext } from "../providers/AuthProvider";
import { getUserSubscription, getPledge, createPledge, updatePledge, listenToUserPledges } from "../firebase/subscription";
import { getPageStats, getDocById } from "../firebase/database";
import { Button } from './ui/button';
import { Eye, Users, DollarSign, Plus, Minus, ChevronUp, ChevronDown } from 'lucide-react';
import { useToast } from './ui/use-toast';
import { useFeatureFlag } from '../utils/feature-flags';
import SubscriptionActivationModal from './SubscriptionActivationModal';
import SupportUsModal from './SupportUsModal';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { CustomAmountModal } from './CustomAmountModal';
import '../styles/pledge-bar-animations.css';

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
  const [showMaxedOutWarning, setShowMaxedOutWarning] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showRebalanceModal, setShowRebalanceModal] = useState(false);
  const [showSupportUsModal, setShowSupportUsModal] = useState(false);
  const isSubscriptionEnabled = useFeatureFlag('subscription_management', user?.email);
  const [pageData, setPageData] = useState(null);
  const [pageTitle, setPageTitle] = useState('Untitled');
  const [sliderValue, setSliderValue] = useState(0);
  const [isOwnPage, setIsOwnPage] = useState(false);
  const [isPageView, setIsPageView] = useState(false);
  const [visible, setVisible] = useState(true);
  const [animateEntry, setAnimateEntry] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [pledges, setPledges] = useState([]);
  const [globalIncrement, setGlobalIncrement] = useState(1);
  const [donateAmount, setDonateAmount] = useState(0);
  const [selectedAmount, setSelectedAmount] = useState(0);
  const [showCustomAmountModal, setShowCustomAmountModal] = useState(false);
  const [customAmountValue, setCustomAmountValue] = useState('0');
  const [showMoreButton, setShowMoreButton] = useState(false);
  const [isAtBottom, setIsAtBottom] = useState(false);
  const contentRef = useRef(null);

  const pageId = pathname.substring(1); // Remove the leading slash to get the page ID
  const [pageStats, setPageStats] = useState({
    totalPledged: 0,
    pledgeCount: 0,
    activeDonors: 0,
    monthlyIncome: 0,
    totalViews: 0,
    followers: 0
  });

  // Set CSS variable for pledgebar background color based on theme
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.style.setProperty(
        '--pledgebar-bg',
        window.matchMedia('(prefers-color-scheme: dark)').matches ? '#18181b' : '#fff'
      );
    }
  }, []);

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

          // Check if user has maxed out their subscription
          setMaxedOut(available <= 0);

          // Get current pledge for this page
          const pledge = await getPledge(user.uid, pageId);
          if (pledge) {
            setCurrentPledge(pledge);
            setPledgeAmount(pledge.amount);
            setSliderValue(pledge.amount);

            // Add to pledges array
            setPledges([pledge]);
          }

          // Set up listener for all user pledges
          const unsubscribe = listenToUserPledges(user.uid, (pledges) => {
            setAllPledges(pledges);

            // Find the current page pledge in the list
            const pagePledge = pledges.find(p => p.pageId === pageId);
            if (pagePledge) {
              setPledges([pagePledge]);
            }
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
        toast.success(`Your pledge to "${pageTitle}" has been updated to $${newAmount.toFixed(2)}/month.`);
      } else {
        // Create new pledge
        await createPledge(user.uid, pageId, newAmount);
        toast.success(`You are now supporting "${pageTitle}" with $${newAmount.toFixed(2)}/month.`);
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
      toast.error("Failed to update your pledge. Please try again.");
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

  // Add scroll event listener for visibility control
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Show/hide based on scroll direction
      if (currentScrollY < lastScrollY || currentScrollY < 100) {
        setVisible(true);
      } else if (currentScrollY > 300 && currentScrollY > lastScrollY) {
        setVisible(false);
      }

      // Check if we're at the bottom of the page
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      const scrollPosition = window.scrollY + windowHeight;
      const isBottom = scrollPosition >= documentHeight - 100;

      setIsAtBottom(isBottom);
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

    // Add scroll event listener
    window.addEventListener('scroll', onScroll, { passive: true });

    // Animate entry after a short delay
    const timer = setTimeout(() => {
      setAnimateEntry(true);
    }, 500);

    // Check if we should show the "more" button
    setShowMoreButton(document.documentElement.scrollHeight > window.innerHeight * 1.5);

    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, [lastScrollY]);

  // Function to scroll to metadata or back to top
  const scrollToMetadata = () => {
    if (isAtBottom) {
      // Scroll to top
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    } else {
      // Scroll to bottom
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: 'smooth'
      });
    }
  };

  // If we're not on a page view, don't show the pledge bar
  if (!isPageView) {
    return null;
  }

  // If user isn't logged in, we'll show a special version of the pledge bar
  // that prompts them to log in
  if (!user) {
    return renderLoggedOutPledgeBar();
  }

  // If this is the user's own page, show stats instead of pledge bar
  if (isOwnPage) {
    return renderOwnPageStats();
  }

  // If user doesn't have an active subscription, we'll show a special version
  // that prompts them to subscribe
  if (!subscription || subscription.status !== 'active') {
    return renderNonSubscriberPledgeBar();
  }

  // Helper function to render the page stats for the owner
  function renderOwnPageStats() {
    return (
      <div
        data-pledge-bar
        className={`fixed bottom-12 left-8 right-8 z-50 flex justify-center transition-all duration-300 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
        } ${animateEntry ? 'spring-and-pulse' : ''}`}
        style={{ transform: visible ? 'translateY(0)' : 'translateY(20px)', opacity: visible ? 1 : 0 }}
      >
        <div
          className="w-full max-w-md mx-auto bg-background/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-shadow rounded-2xl border border-border/40"
        >
          <div className="flex justify-around py-4 px-6">
            <div className="text-center flex flex-col items-center">
              <div className="flex items-center mb-1">
                <Eye className="h-4 w-4 text-muted-foreground mr-1" />
                <p className="text-sm font-medium">{pageStats.totalViews || 0}</p>
              </div>
              <p className="text-xs text-muted-foreground">Views</p>
            </div>
            <div className="text-center flex flex-col items-center">
              <div className="flex items-center mb-1">
                <Users className="h-4 w-4 text-muted-foreground mr-1" />
                <p className="text-sm font-medium">{pageStats.followers || 0}</p>
              </div>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div className="text-center flex flex-col items-center">
              <div className="flex items-center mb-1">
                <DollarSign className="h-4 w-4 text-muted-foreground mr-1" />
                <p className="text-sm font-medium">${pageStats.monthlyIncome?.toFixed(2) || '0.00'}/mo</p>
              </div>
              <p className="text-xs text-muted-foreground">Income</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Helper function to render the pledge bar for logged out users
  function renderLoggedOutPledgeBar() {
    return (
      <div
        data-pledge-bar
        className={`fixed bottom-12 left-8 right-8 z-50 flex justify-center transition-all duration-300 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
        } ${animateEntry ? 'spring-and-pulse' : ''}`}
        style={{ transform: visible ? 'translateY(0)' : 'translateY(20px)', opacity: visible ? 1 : 0 }}
      >
        <div className="w-full max-w-md mx-auto bg-background/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-shadow rounded-2xl border border-border/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium">Support this page</h3>
              <p className="text-xs text-muted-foreground mt-1">Log in to allocate funds to this page</p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                // Show different modal based on subscription feature flag
                if (isSubscriptionEnabled) {
                  setShowActivationModal(true);
                  setShowSupportUsModal(false);
                } else {
                  setShowSupportUsModal(true);
                  setShowActivationModal(false);
                }
              }}
              className="ml-4"
            >
              <DollarSign className="h-4 w-4 mr-1" />
              Support
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Helper function to render the pledge bar for users without an active subscription
  function renderNonSubscriberPledgeBar() {
    return (
      <div
        data-pledge-bar
        className={`fixed bottom-12 left-8 right-8 z-50 flex justify-center transition-all duration-300 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
        } ${animateEntry ? 'spring-and-pulse' : ''}`}
        style={{ transform: visible ? 'translateY(0)' : 'translateY(20px)', opacity: visible ? 1 : 0 }}
      >
        <div className="w-full max-w-md mx-auto bg-background/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-shadow rounded-2xl border border-border/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium">Support this page</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {isSubscriptionEnabled
                  ? "Activate your subscription to support this page"
                  : "Support WeWrite to enable this feature"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (isSubscriptionEnabled) {
                    setShowActivationModal(true);
                    setShowSupportUsModal(false);
                  } else {
                    setShowSupportUsModal(true);
                    setShowActivationModal(false);
                  }
                }}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (isSubscriptionEnabled) {
                    setShowActivationModal(true);
                    setShowSupportUsModal(false);
                  } else {
                    setShowSupportUsModal(true);
                    setShowActivationModal(false);
                  }
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state - now hidden to prevent layout shift
  if (loading) {
    return null;
  }

  const handlePledgeInteraction = (pledgeId, change) => {
    // If user is not logged in, show the appropriate modal based on feature flag
    if (!user) {
      if (isSubscriptionEnabled) {
        setShowActivationModal(true);
      } else {
        setShowSupportUsModal(true);
      }
      return;
    }

    // If user doesn't have an active subscription, show the appropriate modal based on feature flag
    if (!subscription || subscription.status !== 'active') {
      if (isSubscriptionEnabled) {
        setShowActivationModal(true);
      } else {
        setShowSupportUsModal(true);
      }
      return;
    }

    // If we have an active subscription, handle the pledge change
    handlePledgeAmountChange(pledgeId, change);
  };

  const handlePledgeAmountChange = async (pledgeId, change) => {
    try {
      setLoading(true);

      // If we don't have any pledges yet, create a new one
      if (!pledges.length) {
        // Calculate the new amount (start with $1 increment)
        const incrementValue = change * (globalIncrement || 1);
        let newAmount = Math.max(0, incrementValue);
        // Round to 2 decimal places
        newAmount = Math.round(newAmount * 100) / 100;

        // Check subscription limits
        const totalPledged = subscription.pledgedAmount || 0;

        // Don't allow amounts above available budget
        if (newAmount + totalPledged > subscription.amount) {
          setShowMaxedOutWarning(true);
          setLoading(false);
          return;
        }

        // Create a new pledge
        await createPledge(user.uid, pageId, newAmount);
        toast.success(`You are now supporting "${pageTitle}" with $${newAmount.toFixed(2)}/month.`);

        // Update the pledges state
        const newPledge = { id: pageId, pageId, amount: newAmount };
        setPledges([newPledge]);
        setDonateAmount(newAmount);
        setSelectedAmount(newAmount);

        // Update available funds
        const available = Math.max(0, subscription.amount - (subscription.pledgedAmount + newAmount));
        setAvailableFunds(available);

        setShowMaxedOutWarning(false);
        setLoading(false);
        return;
      }

      // Find the current pledge
      const currentPledge = pledges.find(p => p.id === pledgeId);
      if (!currentPledge) {
        console.error("Pledge not found for ID:", pledgeId);
        setLoading(false);
        return;
      }

      // Calculate the new amount
      const incrementValue = change * (globalIncrement || 1);
      let newAmount = Math.max(0, Number(currentPledge.amount || 0) + incrementValue);
      // Round to 2 decimal places
      newAmount = Math.round(newAmount * 100) / 100;

      // Check subscription limits
      const totalPledged = subscription.pledgedAmount || 0;
      const currentAmount = Number(currentPledge.amount || 0);
      const otherPledgesAmount = totalPledged - currentAmount;

      // Don't allow amounts above available budget
      if (newAmount + otherPledgesAmount > subscription.amount) {
        setShowMaxedOutWarning(true);
        setLoading(false);
        return;
      }

      // Update the pledge in the database
      await updatePledge(user.uid, pageId, newAmount, currentAmount);
      toast.success(`Your pledge to "${pageTitle}" has been updated to $${newAmount.toFixed(2)}/month.`);

      // Update pledges with the new amount
      setShowMaxedOutWarning(false);
      const updatedPledges = pledges.map(p => {
        if (p.id === pledgeId) {
          return { ...p, amount: newAmount };
        }
        return p;
      });

      setPledges(updatedPledges);
      setDonateAmount(newAmount);
      setSelectedAmount(newAmount);

      // Update available funds
      const available = Math.max(0, subscription.amount - (otherPledgesAmount + newAmount));
      setAvailableFunds(available);
    } catch (error) {
      console.error('Error updating pledge:', error);
      toast.error("Failed to update your pledge. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handlePledgeCustomAmount = (pledgeId) => {
    // If subscription feature is disabled, show Support Us modal
    if (!isSubscriptionEnabled) {
      setShowSupportUsModal(true);
      setShowActivationModal(false);
      return;
    }

    // If user is not logged in, show activation modal
    if (!user) {
      setShowActivationModal(true);
      return;
    }

    // If user doesn't have an active subscription, show activation modal
    if (!subscription || subscription.status !== 'active') {
      setShowActivationModal(true);
      return;
    }

    // If we have an active subscription, proceed with custom amount
    const pledge = pledges.find(p => p.id === pledgeId);
    if (pledge) {
      // Use the existing pledge amount
      setCustomAmountValue(pledge.amount.toString());
    } else {
      // Start with a default amount of $1
      setCustomAmountValue("1.00");
    }

    // Show the custom amount modal
    setShowCustomAmountModal(true);
  };

  return (
    <>
      <div
        data-pledge-bar
        className={`fixed bottom-12 left-8 right-8 z-50 flex justify-center transition-all duration-300 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
        } ${animateEntry ? 'spring-and-pulse' : ''}`}
        style={{ transform: visible ? 'translateY(0)' : 'translateY(20px)', opacity: visible ? 1 : 0 }}
      >
        <div className="w-full max-w-md mx-auto bg-background/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-shadow rounded-2xl border border-border/40 p-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1">
              <h3 className="text-sm font-medium">Support this page</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Available: ${availableFunds.toFixed(2)}/month
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePledgeInteraction(pledges[0]?.id || pageId, -1)}
                disabled={loading || (pledges[0]?.amount || 0) <= 0}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => handlePledgeInteraction(pledges[0]?.id || pageId, 1)}
                disabled={loading || maxedOut}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="w-full bg-muted/50 h-2 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${Math.min(100, ((pledges[0]?.amount || 0) / (subscription?.amount || 1)) * 100)}%` }}
            ></div>
          </div>

          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-muted-foreground">
              {pledges[0]?.amount ? `$${pledges[0].amount.toFixed(2)}/month` : '$0.00/month'}
            </span>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7 px-2"
              onClick={() => handlePledgeCustomAmount(pledges[0]?.id || pageId)}
            >
              Custom amount
            </Button>
          </div>
        </div>

        {showMoreButton && (
          <Button
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground flex items-center gap-1 hover:bg-transparent hover:text-foreground transition-colors relative mt-2"
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

      {/* Custom Amount Modal */}
      {typeof document !== 'undefined' && createPortal(
        <CustomAmountModal
          open={showCustomAmountModal}
          onOpenChange={setShowCustomAmountModal}
          initialAmount={customAmountValue}
          onAmountConfirm={(amount) => {
            // Convert to number
            const numAmount = parseFloat(amount);
            if (isNaN(numAmount) || numAmount <= 0) {
              toast.error("Please enter a valid amount");
              return;
            }

            // Handle the custom amount pledge
            if (pledges.length > 0) {
              // Update existing pledge
              handlePledgeAmountChange(pledges[0]?.id || pageId, numAmount - (pledges[0]?.amount || 0));
            } else {
              // Create new pledge with the custom amount
              handlePledgeAmountChange(pageId, numAmount);
            }
          }}
          minAmount={0.50}
        />
        ,
        document.body
      )}
    </div>
    </>
  );

  // Helper function to render the page stats for the owner
  const renderOwnPageStats = () => {
    return (
      <div
        data-pledge-bar
        className={`fixed bottom-12 left-8 right-8 z-50 flex justify-center transition-all duration-300 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
        } ${animateEntry ? 'spring-and-pulse' : ''}`}
        style={{ transform: visible ? 'translateY(0)' : 'translateY(20px)', opacity: visible ? 1 : 0 }}
      >
        <div
          className="w-full max-w-md mx-auto bg-background/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-shadow rounded-2xl border border-border/40"
        >
          <div className="flex justify-around py-4 px-6">
            <div className="text-center flex flex-col items-center">
              <div className="flex items-center mb-1">
                <Eye className="h-4 w-4 text-muted-foreground mr-1" />
                <p className="text-sm font-medium">{pageStats.totalViews || 0}</p>
              </div>
              <p className="text-xs text-muted-foreground">Views</p>
            </div>
            <div className="text-center flex flex-col items-center">
              <div className="flex items-center mb-1">
                <Users className="h-4 w-4 text-muted-foreground mr-1" />
                <p className="text-sm font-medium">{pageStats.followers || 0}</p>
              </div>
              <p className="text-xs text-muted-foreground">Followers</p>
            </div>
            <div className="text-center flex flex-col items-center">
              <div className="flex items-center mb-1">
                <DollarSign className="h-4 w-4 text-muted-foreground mr-1" />
                <p className="text-sm font-medium">${pageStats.monthlyIncome?.toFixed(2) || '0.00'}/mo</p>
              </div>
              <p className="text-xs text-muted-foreground">Income</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Helper function to render the pledge bar for logged out users
  const renderLoggedOutPledgeBar = () => {
    return (
      <div
        data-pledge-bar
        className={`fixed bottom-12 left-8 right-8 z-50 flex justify-center transition-all duration-300 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
        } ${animateEntry ? 'spring-and-pulse' : ''}`}
        style={{ transform: visible ? 'translateY(0)' : 'translateY(20px)', opacity: visible ? 1 : 0 }}
      >
        <div className="w-full max-w-md mx-auto bg-background/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-shadow rounded-2xl border border-border/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium">Support this page</h3>
              <p className="text-xs text-muted-foreground mt-1">Log in to allocate funds to this page</p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                // Show different modal based on subscription feature flag
                if (isSubscriptionEnabled) {
                  setShowActivationModal(true);
                  setShowSupportUsModal(false);
                } else {
                  setShowSupportUsModal(true);
                  setShowActivationModal(false);
                }
              }}
              className="ml-4"
            >
              <DollarSign className="h-4 w-4 mr-1" />
              Support
            </Button>
          </div>
        </div>

        {/* Modals rendered at document level */}
        {typeof document !== 'undefined' && isSubscriptionEnabled && createPortal(
          <SubscriptionActivationModal
            isOpen={showActivationModal}
            onClose={() => setShowActivationModal(false)}
            isSignedIn={false}
          />,
          document.body
        )}

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
  };

  // Helper function to render the pledge bar for users without an active subscription
  const renderNonSubscriberPledgeBar = () => {
    return (
      <div
        data-pledge-bar
        className={`fixed bottom-12 left-8 right-8 z-50 flex justify-center transition-all duration-300 ${
          visible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0'
        } ${animateEntry ? 'spring-and-pulse' : ''}`}
        style={{ transform: visible ? 'translateY(0)' : 'translateY(20px)', opacity: visible ? 1 : 0 }}
      >
        <div className="w-full max-w-md mx-auto bg-background/90 dark:bg-gray-800/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-shadow rounded-2xl border border-border/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium">Support this page</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {isSubscriptionEnabled
                  ? "Activate your subscription to support this page"
                  : "Support WeWrite to enable this feature"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  if (isSubscriptionEnabled) {
                    setShowActivationModal(true);
                    setShowSupportUsModal(false);
                  } else {
                    setShowSupportUsModal(true);
                    setShowActivationModal(false);
                  }
                }}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  if (isSubscriptionEnabled) {
                    setShowActivationModal(true);
                    setShowSupportUsModal(false);
                  } else {
                    setShowSupportUsModal(true);
                    setShowActivationModal(false);
                  }
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Modals rendered at document level */}
        {typeof document !== 'undefined' && isSubscriptionEnabled && createPortal(
          <SubscriptionActivationModal
            isOpen={showActivationModal}
            onClose={() => setShowActivationModal(false)}
            isSignedIn={!!user}
          />,
          document.body
        )}

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
  };
};

export default PledgeBar;
