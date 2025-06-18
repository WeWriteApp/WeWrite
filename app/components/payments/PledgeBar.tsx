"use client";
import React, { useState, useEffect, useContext, useRef } from "react";
import { createPortal } from "react-dom";
import { useRouter, usePathname } from "next/navigation";
import { AuthContext } from "../../providers/AuthProvider";
import { getPledge, createPledge, updatePledge, listenToUserPledges, listenToUserSubscription } from "../../firebase/subscription";
import { getOptimizedUserSubscription, getOptimizedUserPledges, createOptimizedSubscriptionListener } from "../../firebase/optimizedSubscription";
import { getPageStats, getDocById } from "../../firebase/database";
import { realPledgeService } from "../../services/realPledgeService";
import { TokenService } from "../../services/tokenService";
import { Button } from "../ui/button";
import { Eye, Users, DollarSign, Plus, Minus, ChevronUp, ChevronDown, Coins } from 'lucide-react';
import { useToast } from "../ui/use-toast";
import { showErrorToastWithCopy } from "../../utils/clipboard";
import { useFeatureFlag } from "../../utils/feature-flags";
import { openExternalLink } from "../../utils/pwa-detection";
import SubscriptionActivationModal from "./SubscriptionActivationModal";
import SupportUsModal from "../payments/SupportUsModal";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { CustomAmountModal } from './CustomAmountModal';
import RegistrationCallToAction from '../utils/RegistrationCallToAction';
import { useRouter } from 'next/navigation';
import '../../styles/pledge-bar-animations.css';

// Type definitions for PledgeBar component
interface PageData {
  id: string;
  title: string;
  userId: string;
  content?: any;
  isPublic?: boolean;
  lastModified?: any;
}

interface PageStats {
  totalPledged: number;
  pledgeCount: number;
  activeDonors: number;
  monthlyIncome: number;
  totalViews: number;
  followers: number;
}

interface Subscription {
  id: string;
  userId: string;
  status: string;
  amount: number;
  pledgedAmount?: number;
  stripeSubscriptionId?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface Pledge {
  id: string;
  userId: string;
  pageId: string;
  amount: number;
  createdAt?: any;
  updatedAt?: any;
}

interface TokenAllocation {
  resourceType: string;
  resourceId: string;
  tokens: number;
}

interface SupporterStats {
  count: number;
  totalAmount: number;
}

const PledgeBar: React.FC = () => {
  const { user } = useContext(AuthContext);
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [pledgeAmount, setPledgeAmount] = useState<number>(0);
  const [currentPledge, setCurrentPledge] = useState<Pledge | null>(null);
  const [allPledges, setAllPledges] = useState<Pledge[]>([]);
  const [availableFunds, setAvailableFunds] = useState<number>(0);
  const [isConfirmed, setIsConfirmed] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);
  const [maxedOut, setMaxedOut] = useState<boolean>(false);
  const [showMaxedOutWarning, setShowMaxedOutWarning] = useState<boolean>(false);
  const [showActivationModal, setShowActivationModal] = useState<boolean>(false);

  // Token-based state
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);
  const [currentTokenAllocation, setCurrentTokenAllocation] = useState<number>(0);
  const [tokenAllocations, setTokenAllocations] = useState<TokenAllocation[]>([]);
  const [showRebalanceModal, setShowRebalanceModal] = useState<boolean>(false);
  const [showSupportUsModal, setShowSupportUsModal] = useState<boolean>(false);
  const isSubscriptionEnabled = useFeatureFlag('payments', user?.email, user?.uid);
  const [pageData, setPageData] = useState<PageData | null>(null);
  const [pageTitle, setPageTitle] = useState<string>('Untitled');
  const [sliderValue, setSliderValue] = useState<number>(0);
  const [isOwnPage, setIsOwnPage] = useState<boolean>(false);
  const [isPageView, setIsPageView] = useState<boolean>(false);
  const [visible, setVisible] = useState<boolean>(true);
  const [animateEntry, setAnimateEntry] = useState<boolean>(false);
  const [lastScrollY, setLastScrollY] = useState<number>(0);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down' | 'none'>('none');
  const [pledges, setPledges] = useState<Pledge[]>([]);
  const [globalIncrement, setGlobalIncrement] = useState<number>(1);
  const [totalOtherPledges, setTotalOtherPledges] = useState<number>(0);
  const [donateAmount, setDonateAmount] = useState<number>(0);
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [showCustomAmountModal, setShowCustomAmountModal] = useState<boolean>(false);
  const [customAmountValue, setCustomAmountValue] = useState<string>('0');
  const [showMoreButton, setShowMoreButton] = useState<boolean>(false);
  const [isAtBottom, setIsAtBottom] = useState<boolean>(false);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [realPledgeData, setRealPledgeData] = useState<any>(null);
  const [supporterStats, setSupporterStats] = useState<SupporterStats>({ count: 0, totalAmount: 0 });
  const contentRef = useRef<HTMLDivElement>(null);

  const pageId = pathname.substring(1); // Remove the leading slash to get the page ID
  const [pageStats, setPageStats] = useState<PageStats>({
    totalPledged: 0,
    pledgeCount: 0,
    activeDonors: 0,
    monthlyIncome: 0,
    totalViews: 0,
    followers: 0
  });

  // Load real supporter statistics
  useEffect(() => {
    if (!pageId) return;

    const unsubscribe = realPledgeService.subscribeSupporterStats('page', pageId, (stats) => {
      setSupporterStats(stats);
      setPageStats(prev => ({
        ...prev,
        totalPledged: stats.totalAmount,
        pledgeCount: stats.count,
        activeDonors: stats.count,
        monthlyIncome: stats.totalAmount
      }));
    });

    return () => unsubscribe();
  }, [pageId]);

  // Ensure component is mounted before rendering portals
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Set CSS variable for pledgebar background color based on theme
  useEffect(() => {
    if (typeof window !== 'undefined') {
      document.documentElement.style.setProperty(
        '--pledgebar-bg',
        window.matchMedia('(prefers-color-scheme: dark)').matches ? '#18181b' : "#fff"
      );
    }
  }, []);

  // Effect to check if subscription feature is enabled and fetch page data
  useEffect(() => {
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
            console.log('PledgeBar: Current user is the page owner');
            setIsOwnPage(true);
          } else {
            console.log('PledgeBar: Current user is NOT the page owner');
            setIsOwnPage(false);
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
    if (!user || !pageId) {
      setLoading(false);
      return;
    }

    const fetchSubscriptionAndPledge = async () => {
      try {
        // Use optimized Firebase function for subscription data
        const { getOptimizedUserSubscription } = await import('../../firebase/optimizedSubscription');
        const userSubscription = await getOptimizedUserSubscription(user.uid, { useCache: true });

        setSubscription(userSubscription);
        console.log('PledgeBar: User subscription status (optimized):', userSubscription?.status);

        if (userSubscription && userSubscription.status === 'active') {
          // Calculate available funds
          const totalAmount = userSubscription.amount || 0;
          const pledgedAmount = userSubscription.pledgedAmount || 0;
          const available = Math.max(0, totalAmount - pledgedAmount);
          setAvailableFunds(available);

          // Check if user has maxed out their subscription
          setMaxedOut(available <= 0);

          // Get current pledge for this page using real pledge service
          const realPledge = await realPledgeService.getUserPledgeToResource(user.uid, 'page', pageId);
          if (realPledge) {
            setRealPledgeData(realPledge);
            setCurrentPledge(realPledge);
            setPledgeAmount(realPledge.amount);
            setSliderValue(realPledge.amount);
            setPledges([realPledge]);
          }

          // Also get legacy pledge for backward compatibility
          const pledge = await getPledge(user.uid, pageId);
          if (pledge && !realPledge) {
            setCurrentPledge(pledge);
            setPledgeAmount(pledge.amount);
            setSliderValue(pledge.amount);
            setPledges([pledge]);
          }

          // Use optimized pledges fetching with caching
          const allUserPledges = await getOptimizedUserPledges(user.uid, {
            useCache: true,
            cacheTTL: 5 * 60 * 1000 // 5 minutes cache
          });
          setAllPledges(allUserPledges);

          // Find the current page pledge in the list
          const pagePledge = allUserPledges.find(p => p.pageId === pageId);
          if (pagePledge) {
            setPledges([pagePledge]);
          }

          // Calculate total pledges for other pages (excluding current page)
          const otherPledgesTotal = allUserPledges
            .filter(p => p.pageId !== pageId)
            .reduce((sum, pledge) => sum + (pledge.amount || 0), 0);
          setTotalOtherPledges(otherPledgesTotal);
        }
      } catch (error) {
        console.error('Error fetching subscription or pledge:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionAndPledge();

    // Set up real-time listener for subscription changes (without caching/throttling)
    const unsubscribe = listenToUserSubscription(user.uid, (updatedSubscription) => {
      if (updatedSubscription) {
        setSubscription(updatedSubscription);

        // Recalculate available funds
        const totalAmount = updatedSubscription.amount || 0;
        const pledgedAmount = updatedSubscription.pledgedAmount || 0;
        const available = Math.max(0, totalAmount - pledgedAmount);
        setAvailableFunds(available);
        setMaxedOut(available <= 0);
      } else {
        // No subscription found
        setSubscription(null);
        setAvailableFunds(0);
        setMaxedOut(false);
      }
    }, { verbose: process.env.NODE_ENV === 'development' });

    return () => unsubscribe();
  }, [user, pageId, isSubscriptionEnabled, isOwnPage]);

  // Effect to fetch token balance and allocations when subscription is enabled
  useEffect(() => {
    if (!user || !pageId || !isSubscriptionEnabled) {
      return;
    }

    const fetchTokenData = async () => {
      try {
        // Get user's token balance
        const balance = await TokenService.getUserTokenBalance(user.uid);
        setTokenBalance(balance);

        // Get current token allocation for this page
        const allocations = await TokenService.getUserTokenAllocations(user.uid);
        setTokenAllocations(allocations);

        // Find allocation for current page
        const pageAllocation = allocations.find(
          allocation => allocation.resourceType === 'page' && allocation.resourceId === pageId
        );
        setCurrentTokenAllocation(pageAllocation?.tokens || 0);

      } catch (error) {
        console.error('Error fetching token data:', error);
      }
    };

    fetchTokenData();
  }, [user, pageId, isSubscriptionEnabled]);

  // Handle pledge amount change via slider
  const handleSliderChange = (value: number[]): void => {
    const newValue = value[0];
    setSliderValue(newValue);

    // Check if the new value exceeds available funds
    if (newValue > availableFunds + (currentPledge?.amount || 0)) {
      setShowMaxedOutWarning(true);
    } else {
      setShowMaxedOutWarning(false);
    }
  };

  // Handle pledge submission with real payment processing
  const handlePledgeSubmit = async (): Promise<void> => {
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

      // For real payment processing, we need a payment method
      // For now, we'll use the legacy system but this should be updated
      // to use the new real payment processing API

      if (currentPledge || realPledgeData) {
        // Update existing pledge (legacy system for now)
        await updatePledge(user.uid, pageId, newAmount, currentPledge?.amount || realPledgeData?.amount || 0);
        toast.success(`Your pledge to "${pageTitle}" has been updated to $${newAmount.toFixed(2)}/month.`);
      } else {
        // Create new pledge (legacy system for now)
        await createPledge(user.uid, pageId, newAmount);
        toast.success(`You are now supporting "${pageTitle}" with $${newAmount.toFixed(2)}/month.`);
      }

      // Update current pledge
      setCurrentPledge({
        ...currentPledge,
        amount: newAmount
      });

      // Refresh real pledge data
      const updatedRealPledge = await realPledgeService.getUserPledgeToResource(user.uid, 'page', pageId);
      if (updatedRealPledge) {
        setRealPledgeData(updatedRealPledge);
      }

      // Update available funds
      const totalAmount = subscription.amount || 0;
      const pledgedAmount = subscription.pledgedAmount || 0;
      const available = Math.max(0, totalAmount - pledgedAmount);
      setAvailableFunds(available);

    } catch (error) {
      console.error('Error submitting pledge:', error);

      // Use enhanced error toast with copy functionality
      showErrorToastWithCopy("Failed to update your pledge", {
        description: "Please try again or contact support if the issue persists.",
        additionalInfo: {
          errorType: "PLEDGE_UPDATE_ERROR",
          userId: user?.uid,
          pageId: pageId,
          pageTitle: pageTitle,
          pledgeAmount: sliderValue,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          errorMessage: error.message,
          errorStack: error.stack,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle rebalancing pledges
  const handleRebalancePledges = async (): Promise<void> => {
    setShowRebalanceModal(false);

    // For now, just show the subscription management page
    router.push('/settings/subscription/manage');
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

  // Enhanced scroll event listener with smooth show/hide behavior
  useEffect(() => {
    let ticking = false;
    let scrollTimeout = null;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const scrollDelta = currentScrollY - lastScrollY;

      // Determine scroll direction
      let newScrollDirection = 'none';
      if (scrollDelta > 5) {
        newScrollDirection = 'down';
      } else if (scrollDelta < -5) {
        newScrollDirection = 'up';
      }

      // Only update if direction actually changed
      if (newScrollDirection !== 'none' && newScrollDirection !== scrollDirection) {
        setScrollDirection(newScrollDirection);

        // Clear any existing timeout
        if (scrollTimeout) {
          clearTimeout(scrollTimeout);
        }

        // Handle visibility changes with smooth animations
        if (newScrollDirection === 'down' && currentScrollY > 100 && visible && !isAnimating) {
          // User scrolled down - hide the bar with animation
          setIsAnimating(true);
          setVisible(false);

          // Clear animation state after animation completes
          scrollTimeout = setTimeout(() => {
            setIsAnimating(false);
          }, 400); // Match animation duration
        } else if (newScrollDirection === 'up' && !visible && !isAnimating) {
          // User scrolled up - show the bar with animation
          setIsAnimating(true);
          setVisible(true);

          // Clear animation state after animation completes
          scrollTimeout = setTimeout(() => {
            setIsAnimating(false);
          }, 400); // Match animation duration
        }
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
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
    };
  }, [lastScrollY, scrollDirection, visible, isAnimating]);

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
        className={`fixed bottom-12 left-8 right-8 z-50 flex justify-center pledge-bar-transition ${
          !visible && isAnimating ? 'slide-down' :
          visible && isAnimating ? 'slide-up' : ''
        } ${animateEntry ? 'spring-and-pulse' : ''}`}
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(calc(100% + 3rem))',
          opacity: visible ? 1 : 0,
          visibility: visible || isAnimating ? 'visible' : 'hidden'
        }}
      >
        <div
          className="w-full max-w-md mx-auto wewrite-card bg-background/95 dark:bg-gray-800/95 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl border border-border/40"
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
                <p className="text-sm font-medium">{supporterStats.count || 0}</p>
              </div>
              <p className="text-xs text-muted-foreground">Supporters</p>
            </div>
            <div className="text-center flex flex-col items-center">
              <div className="flex items-center mb-1">
                <DollarSign className="h-4 w-4 text-muted-foreground mr-1" />
                <p className="text-sm font-medium">${supporterStats.totalAmount?.toFixed(2) || '0.00'}/mo</p>
              </div>
              <p className="text-xs text-muted-foreground">Pledged</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Helper function to render the call-to-action for logged out users
  function renderLoggedOutPledgeBar() {
    // Use the new RegistrationCallToAction component instead of "under construction" message
    return <RegistrationCallToAction />;
  }

  // Helper function to render the pledge bar for users without an active subscription
  function renderNonSubscriberPledgeBar() {
    return (
      <div
        data-pledge-bar
        className={`fixed bottom-12 left-8 right-8 z-50 flex justify-center pledge-bar-transition ${
          !visible && isAnimating ? 'slide-down' :
          visible && isAnimating ? 'slide-up' : ''
        } ${animateEntry ? 'spring-and-pulse' : ''}`}
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(calc(100% + 3rem))',
          opacity: visible ? 1 : 0,
          visibility: visible || isAnimating ? 'visible' : 'hidden'
        }}
      >
        <div className="w-full max-w-md mx-auto wewrite-card bg-background/95 dark:bg-gray-800/95 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl border border-border/40 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-sm font-medium">
                {isSubscriptionEnabled ? "Activate Subscription" : "Support WeWrite"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {isSubscriptionEnabled
                  ? "Activate your subscription to support this page"
                  : "Help us build the future of collaborative writing"}
              </p>
            </div>
            {isSubscriptionEnabled ? (
              <Button
                size="sm"
                onClick={() => {
                  try {
                    console.log('PledgeBar: Navigating to subscription page');
                    // For activation, always go to subscription setup page
                    router.push('/settings/subscription');
                  } catch (error) {
                    console.error('Navigation error:', error);
                    toast({
                      title: "Navigation Error",
                      description: "Unable to navigate to subscription page. Redirecting...",
                      variant: "destructive",
                    });
                    // Fallback to window.location if router fails
                    setTimeout(() => {
                      window.location.href = '/settings/subscription';
                    }, 1000);
                  }
                }}
                className="bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white border-0"
              >
                {subscription && subscription.status === 'active' ? 'Manage Subscription' :
                 subscription && subscription.status !== 'active' ? 'Reactivate Subscription' : 'Activate Subscription'}
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => {
                  setShowSupportUsModal(true);
                  setShowActivationModal(false);
                }}
                className="bg-gradient-to-r from-blue-600 to-teal-500 hover:from-blue-700 hover:to-teal-600 text-white border-0"
              >
                Support Us
              </Button>
            )}
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
      console.log('PledgeBar: User not logged in, showing login modal');
      if (isSubscriptionEnabled) {
        setShowActivationModal(true);
        setShowSupportUsModal(false);
      } else {
        setShowSupportUsModal(true);
        setShowActivationModal(false);
      }
      return;
    }

    // If user doesn't have an active subscription, show the appropriate modal based on feature flag
    if (!subscription || subscription.status !== 'active') {
      console.log('PledgeBar: User has no active subscription, showing subscription modal');
      if (isSubscriptionEnabled) {
        setShowActivationModal(true);
        setShowSupportUsModal(false);
      } else {
        setShowSupportUsModal(true);
        setShowActivationModal(false);
      }
      return;
    }

    // If we have an active subscription, handle the pledge change
    console.log('PledgeBar: User has active subscription, handling pledge change');
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

      // Use enhanced error toast with copy functionality
      showErrorToastWithCopy("Failed to update your pledge", {
        description: "Please try again or contact support if the issue persists.",
        additionalInfo: {
          errorType: "PLEDGE_AMOUNT_CHANGE_ERROR",
          userId: user?.uid,
          pageId: pageId,
          pageTitle: pageTitle,
          pledgeId: pledgeId,
          changeAmount: changeAmount,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
          errorMessage: error.message,
          errorStack: error.stack,
        },
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePledgeCustomAmount = (pledgeId) => {
    // If subscription feature is disabled, show Support Us modal
    if (!isSubscriptionEnabled) {
      console.log('PledgeBar: Subscription feature disabled, showing Support Us modal');
      setShowSupportUsModal(true);
      setShowActivationModal(false);
      return;
    }

    // If user is not logged in, show activation modal
    if (!user) {
      console.log('PledgeBar: User not logged in, showing activation modal');
      setShowActivationModal(true);
      setShowSupportUsModal(false);
      return;
    }

    // If user doesn't have an active subscription, show activation modal
    if (!subscription || subscription.status !== 'active') {
      console.log('PledgeBar: User has no active subscription, showing activation modal');
      setShowActivationModal(true);
      setShowSupportUsModal(false);
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

  // Token allocation functions
  const handleTokenAllocation = async (change) => {
    if (!user || !pageId || !pageData) {
      return;
    }

    try {
      setLoading(true);

      const newTokens = Math.max(0, currentTokenAllocation + change);

      // Check if user has enough available tokens
      if (newTokens > currentTokenAllocation && tokenBalance) {
        const additionalTokensNeeded = newTokens - currentTokenAllocation;
        if (additionalTokensNeeded > tokenBalance.availableTokens) {
          toast.error('Insufficient tokens available');
          setLoading(false);
          return;
        }
      }

      // Allocate tokens via TokenService
      const result = await TokenService.allocateTokens(
        user.uid,
        pageData.userId, // recipient user ID (page owner)
        'page',
        pageId,
        newTokens
      );

      if (result.success) {
        setCurrentTokenAllocation(newTokens);

        // Refresh token balance
        const updatedBalance = await TokenService.getUserTokenBalance(user.uid);
        setTokenBalance(updatedBalance);

        toast.success(
          newTokens > currentTokenAllocation
            ? `Allocated ${newTokens} tokens to "${pageTitle}"`
            : newTokens === 0
            ? `Removed token allocation from "${pageTitle}"`
            : `Updated token allocation to ${newTokens} tokens`
        );
      } else {
        toast.error(result.error || 'Failed to allocate tokens');
      }

    } catch (error) {
      console.error('Error allocating tokens:', error);
      toast.error('Failed to allocate tokens');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to render the subscription usage pledge bar with tokens
  function renderSubscriptionUsagePledgeBar() {
    if (!subscription || subscription.status !== 'active') {
      return null;
    }

    // Use token-based calculations when available
    if (tokenBalance) {
      const totalTokens = tokenBalance.totalTokens || 0;
      const allocatedTokens = tokenBalance.allocatedTokens || 0;
      const availableTokens = tokenBalance.availableTokens || 0;
      const currentPageTokens = currentTokenAllocation || 0;
      const otherPagesTokens = allocatedTokens - currentPageTokens;

      // Calculate percentages for the progress bar segments
      const currentPagePercentage = totalTokens > 0 ? (currentPageTokens / totalTokens) * 100 : 0;
      const otherPagesPercentage = totalTokens > 0 ? (otherPagesTokens / totalTokens) * 100 : 0;
      const availablePercentage = totalTokens > 0 ? (availableTokens / totalTokens) * 100 : 0;

      return renderTokenBasedPledgeBar(
        totalTokens,
        currentPageTokens,
        otherPagesTokens,
        availableTokens,
        currentPagePercentage,
        otherPagesPercentage,
        availablePercentage
      );
    }

    // Fallback to dollar-based display
    const currentPagePledge = pledges[0]?.amount || 0;
    const totalSubscriptionAmount = subscription.amount || 0;
    const availableAmount = Math.max(0, totalSubscriptionAmount - (subscription.pledgedAmount || 0));

    // Calculate percentages for the progress bar segments
    const currentPagePercentage = totalSubscriptionAmount > 0 ? (currentPagePledge / totalSubscriptionAmount) * 100 : 0;
    const otherPagesPercentage = totalSubscriptionAmount > 0 ? (totalOtherPledges / totalSubscriptionAmount) * 100 : 0;
    const usedPercentage = currentPagePercentage + otherPagesPercentage;
    const availablePercentage = Math.max(0, 100 - usedPercentage);

    const handleSubscriptionBarClick = () => {
      router.push('/settings/subscription/manage');
    };

  // Helper function to render token-based pledge bar
  function renderTokenBasedPledgeBar(
    totalTokens,
    currentPageTokens,
    otherPagesTokens,
    availableTokens,
    currentPagePercentage,
    otherPagesPercentage,
    availablePercentage
  ) {
    return (
      <div
        data-pledge-bar
        className={`fixed bottom-12 left-8 right-8 z-50 flex justify-center pledge-bar-transition ${
          !visible && isAnimating ? 'slide-down' :
          visible && isAnimating ? 'slide-up' : ''
        } ${animateEntry ? 'spring-and-pulse' : ''}`}
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(calc(100% + 3rem))',
          opacity: visible ? 1 : 0,
          visibility: visible || isAnimating ? 'visible' : 'hidden'
        }}
      >
        <div className="w-full max-w-md mx-auto wewrite-card bg-background/95 dark:bg-gray-800/95 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl border border-border/40 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Coins className="h-4 w-4 text-primary" />
                Monthly Tokens: {totalTokens}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {totalTokens - availableTokens} allocated • {availableTokens} available
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleTokenAllocation(-1)}
                disabled={loading || currentPageTokens <= 0}
                className="h-8 w-8 p-0"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => handleTokenAllocation(1)}
                disabled={loading || availableTokens <= 0}
                className="h-8 w-8 p-0"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Token allocation progress bar */}
          <div className="w-full bg-muted/50 h-4 rounded-full overflow-hidden mb-3 border border-border/20">
            <div className="h-full flex">
              {/* Current page segment */}
              {currentPagePercentage > 0 && (
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 relative group"
                  style={{ width: `${currentPagePercentage}%` }}
                  title={`This page: ${currentPageTokens} tokens (${currentPagePercentage.toFixed(1)}%)`}
                >
                  {currentPagePercentage > 15 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-medium text-white/90">
                        {currentPageTokens}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {/* Other pages segment */}
              {otherPagesPercentage > 0 && (
                <div
                  className="h-full bg-gradient-to-r from-primary/60 to-primary/40 transition-all duration-500"
                  style={{ width: `${otherPagesPercentage}%` }}
                  title={`Other pages: ${otherPagesTokens} tokens (${otherPagesPercentage.toFixed(1)}%)`}
                >
                  {otherPagesPercentage > 15 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-medium text-white/90">
                        {otherPagesTokens}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {/* Available segment */}
              {availablePercentage > 0 && (
                <div
                  className="h-full bg-gradient-to-r from-muted/40 to-muted/20 transition-all duration-500 border-l border-border/30"
                  style={{ width: `${availablePercentage}%` }}
                  title={`Available: ${availableTokens} tokens (${availablePercentage.toFixed(1)}%)`}
                >
                  {availablePercentage > 20 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-medium text-muted-foreground">
                        {availableTokens} free
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Current page allocation display */}
          <div className="flex justify-between items-center text-xs">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">This page:</span>
              <span className="font-medium text-primary">
                {currentPageTokens} tokens
              </span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7 px-2"
              onClick={() => router.push('/settings/subscription/manage')}
            >
              Manage →
            </Button>
          </div>
        </div>
      </div>
    );
  }

    return (
      <div
        data-pledge-bar
        className={`fixed bottom-12 left-8 right-8 z-50 flex justify-center pledge-bar-transition ${
          !visible && isAnimating ? 'slide-down' :
          visible && isAnimating ? 'slide-up' : ''
        } ${animateEntry ? 'spring-and-pulse' : ''}`}
        style={{
          transform: visible ? 'translateY(0)' : 'translateY(calc(100% + 3rem))',
          opacity: visible ? 1 : 0,
          visibility: visible || isAnimating ? 'visible' : 'hidden'
        }}
      >
        <div
          className="w-full max-w-md mx-auto wewrite-card bg-background/95 dark:bg-gray-800/95 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl border border-border/40 p-4 cursor-pointer group"
          onClick={handleSubscriptionBarClick}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex-1">
              <h3 className="text-sm font-medium group-hover:text-primary transition-colors">
                Monthly Subscription: ${totalSubscriptionAmount.toFixed(2)}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                ${(subscription.pledgedAmount || 0).toFixed(2)} allocated • ${availableAmount.toFixed(2)} available
              </p>
            </div>
            <div className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
              Manage →
            </div>
          </div>

          {/* Enhanced composition bar showing allocation breakdown */}
          <div className="w-full bg-muted/50 h-4 rounded-full overflow-hidden mb-3 border border-border/20">
            <div className="h-full flex">
              {/* Current page segment */}
              {currentPagePercentage > 0 && (
                <div
                  className="h-full bg-gradient-to-r from-primary to-primary/80 transition-all duration-500 relative group"
                  style={{ width: `${currentPagePercentage}%` }}
                  title={`This page: $${currentPagePledge.toFixed(2)} (${currentPagePercentage.toFixed(1)}%)`}
                >
                  {currentPagePercentage > 15 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-medium text-white/90">
                        ${currentPagePledge.toFixed(0)}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {/* Other pages segment */}
              {otherPagesPercentage > 0 && (
                <div
                  className="h-full bg-gradient-to-r from-primary/60 to-primary/40 transition-all duration-500"
                  style={{ width: `${otherPagesPercentage}%` }}
                  title={`Other pages: $${totalOtherPledges.toFixed(2)} (${otherPagesPercentage.toFixed(1)}%)`}
                >
                  {otherPagesPercentage > 15 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-medium text-white/90">
                        ${totalOtherPledges.toFixed(0)}
                      </span>
                    </div>
                  )}
                </div>
              )}
              {/* Available segment */}
              {availablePercentage > 0 && (
                <div
                  className="h-full bg-gradient-to-r from-muted/40 to-muted/20 transition-all duration-500 border-l border-border/30"
                  style={{ width: `${availablePercentage}%` }}
                  title={`Available: $${availableAmount.toFixed(2)} (${availablePercentage.toFixed(1)}%)`}
                >
                  {availablePercentage > 20 && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-medium text-muted-foreground">
                        ${availableAmount.toFixed(0)} free
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Simplified legend */}
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-4">
              {currentPagePledge > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-primary rounded-full"></div>
                  <span className="text-muted-foreground font-medium">This page</span>
                </div>
              )}
              {totalOtherPledges > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-primary/60 rounded-full"></div>
                  <span className="text-muted-foreground font-medium">Other pages</span>
                </div>
              )}
              {availableAmount > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-muted/60 rounded-full"></div>
                  <span className="text-muted-foreground font-medium">Available</span>
                </div>
              )}
            </div>
            <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors font-medium">
              Click to manage
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Conditionally render subscription usage bar or regular pledge bar */}
      {isSubscriptionEnabled && subscription && subscription.status === 'active' ? (
        renderSubscriptionUsagePledgeBar()
      ) : !user ? (
        renderLoggedOutPledgeBar()
      ) : (!subscription || subscription.status !== 'active') ? (
        renderNonSubscriberPledgeBar()
      ) : (
        <div
          data-pledge-bar
          className={`fixed bottom-12 left-8 right-8 z-50 flex justify-center pledge-bar-transition ${
            !visible && isAnimating ? 'slide-down' :
            visible && isAnimating ? 'slide-up' : ''
          } ${animateEntry ? 'spring-and-pulse' : ''}`}
          style={{
            transform: visible ? 'translateY(0)' : 'translateY(calc(100% + 3rem))',
            opacity: visible ? 1 : 0,
            visibility: visible || isAnimating ? 'visible' : 'hidden'
          }}
        >
        <div className="w-full max-w-md mx-auto wewrite-card bg-background/95 dark:bg-gray-800/95 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-300 rounded-xl border border-border/40 p-4">
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
        </div>
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
      {isMounted && createPortal(
        <SubscriptionActivationModal
          isOpen={showActivationModal}
          onClose={() => setShowActivationModal(false)}
          isSignedIn={!!user}
        />,
        document.body
      )}

      {/* When subscription is disabled, show the Support Us modal */}
      {isMounted && createPortal(
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
      {isMounted && createPortal(
        <CustomAmountModal
          open={showCustomAmountModal}
          onOpenChange={setShowCustomAmountModal}
          initialAmount={customAmountValue}
          onAmountConfirm={(amount) => {
            // Convert to number
            const numAmount = parseFloat(amount);
            if (isNaN(numAmount) || numAmount <= 0) {
              // Simple validation error - no need for copy functionality
              toast.error("Please enter a valid amount", { enableCopy: false });
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
        />,
        document.body
      )}
    </>
  );






};

export default PledgeBar;
