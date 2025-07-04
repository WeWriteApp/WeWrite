"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button } from "../ui/button";
import { Heart, DollarSign } from "lucide-react";
import { TokenPieChart } from "../ui/TokenPieChart";
import Logo from "../ui/Logo";
import { openExternalLink } from "../../utils/pwa-detection";
import { useSidebarContext } from "./UnifiedSidebar";
import { useCurrentAccount } from "../../providers/CurrentAccountProvider";
import { useFeatureFlag } from "../../utils/feature-flags";
import { listenToUserSubscription } from "../../firebase/subscription";
import { getSubscriptionButtonText, getSubscriptionNavigationPath, isActiveSubscription } from "../../utils/subscriptionStatus";
import { TokenService } from "../../services/tokenService";
import { TokenBalance } from "../../types/database";
import { getLoggedOutTokenBalance, getUserTokenBalance } from "../../utils/simulatedTokens";

export default function Header() {
  const router = useRouter();
  const { session } = useCurrentAccount();
  const { sidebarWidth, isExpanded, isHovering } = useSidebarContext();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [headerHeight, setHeaderHeight] = React.useState(80); // Start at 80px (h-20)

  const [subscription, setSubscription] = React.useState(null);
  const [tokenBalance, setTokenBalance] = React.useState<TokenBalance | null>(null);
  const [simulatedTokenBalance, setSimulatedTokenBalance] = React.useState<any>(null);
  const headerRef = React.useRef<HTMLDivElement>(null);

  // Check if payments feature is enabled
  const isPaymentsEnabled = useFeatureFlag('payments', session?.email, session?.uid);

  // Helper function to render token allocation display
  const renderTokenAllocationDisplay = () => {
    // Use real token balance if available, otherwise use unfunded tokens
    const balance = tokenBalance || simulatedTokenBalance;
    if (!balance) return null;

    return (
      <TokenPieChart
        allocatedTokens={balance.allocatedTokens}
        totalTokens={balance.totalTokens}
        size={28}
        strokeWidth={2.5}
        className="hover:opacity-80 transition-opacity"
        onClick={() => router.push('/settings/spend-tokens')}
      />
    );
  };

  // Calculate header positioning width - only respond to persistent expanded state, not hover
  // Hover state should overlay without affecting header positioning
  const headerSidebarWidth = React.useMemo(() => {
    // Header should only respond to persistent expanded state, not hover state
    // When expanded: always use full width (256px) regardless of hover
    // When collapsed: always use collapsed width (64px) regardless of hover
    if (isExpanded) {
      return sidebarWidth; // Use full expanded width (256px)
    } else if (sidebarWidth > 0) {
      return 64; // Use collapsed width (64px) for collapsed state
    } else {
      return 0; // No sidebar (user not authenticated)
    }
  }, [isExpanded, sidebarWidth]);

  // Listen to user subscription changes
  React.useEffect(() => {
    console.log('🎯 Header: Subscription effect triggered', {
      session: !!session,
      isPaymentsEnabled,
      sessionUid: session?.uid
    });

    if (!session || !isPaymentsEnabled) {
      console.log('🎯 Header: No session or payments disabled, clearing subscription');
      setSubscription(null);
      return;
    }

    console.log('🎯 Header: Setting up subscription listener for user:', session.uid);
    const unsubscribe = listenToUserSubscription(session.uid, (subscriptionData) => {
      console.log('🎯 Header: Subscription updated:', sub);
      setSubscription(subscriptionData);
    }, { verbose: false });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [session, isPaymentsEnabled]);

  // Fetch token balance directly via API (simpler approach)
  React.useEffect(() => {
    console.log('🎯 Header: Token balance effect triggered', {
      session: !!session,
      isPaymentsEnabled
    });

    if (!session || !isPaymentsEnabled) {
      console.log('🎯 Header: No session or payments disabled, clearing token balance');
      setTokenBalance(null);
      return;
    }

    console.log('🎯 Header: Fetching token balance via API');
    // Fetch token balance directly via API (same approach as spend-tokens page)
    fetch('/api/tokens/balance')
      .then(response => response.json())
      .then(data => {
        console.log('🎯 Header: Token balance API response:', data);
        if (data.summary) {
          console.log('🎯 Header: Setting token balance from summary:', data.summary);
          setTokenBalance(data.summary);
        } else if (data.balance) {
          console.log('🎯 Header: Setting token balance from balance:', data.balance);
          setTokenBalance(data.balance);
        } else {
          console.log('🎯 Header: No balance or summary in response');
        }
      })
      .catch(error => {
        console.error('🎯 Header: Failed to fetch token balance:', error);
      });
  }, [session, isPaymentsEnabled]);

  // Load unfunded token balance for users without subscriptions
  React.useEffect(() => {
    if (!isPaymentsEnabled) return;

    // If user has any subscription (active or canceled), don't load unfunded tokens
    if (subscription) {
      setSimulatedTokenBalance(null);
      return;
    }

    const loadUnfundedTokens = () => {
      // Load unfunded tokens for logged-out users or users without subscriptions
      if (!session) {
        // Logged-out user - load from localStorage
        const balance = getLoggedOutTokenBalance();
        setSimulatedTokenBalance(balance);
      } else {
        // Logged-in user without subscription - load user-specific unfunded tokens
        const balance = getUserTokenBalance(session.uid);
        setSimulatedTokenBalance(balance);
      }
    };

    // Initial load
    loadUnfundedTokens();

    // Listen for localStorage changes to update in real-time
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith('wewrite_simulated_tokens')) {
        loadUnfundedTokens();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [session, isPaymentsEnabled, subscription]);

  // Calculate and update header height
  React.useEffect(() => {
    const handleScroll = () => {
      // Update scroll state
      const scrollY = window.scrollY;
      setIsScrolled(scrollY > 10);

      // Calculate smooth header height transition
      // Transition from 80px to 56px over 50px of scroll
      const maxScroll = 50;
      const minHeight = 56; // h-14
      const maxHeight = 80; // h-20
      const scrollRatio = Math.min(scrollY / maxScroll, 1);
      const newHeight = maxHeight - (maxHeight - minHeight) * scrollRatio;
      setHeaderHeight(newHeight);

      // Calculate scroll progress for the progress bar based on main content area only
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;

      // Find the main content area (exclude footer sections)
      const mainContentElement = document.querySelector('[data-page-content]');
      let contentHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;

      if (mainContentElement) {
        // Calculate the height up to the end of main content
        const mainContentRect = mainContentElement.getBoundingClientRect();
        const mainContentBottom = mainContentRect.bottom + window.scrollY;
        const viewportHeight = window.innerHeight;

        // Use the main content bottom as the effective scroll height
        contentHeight = Math.max(0, mainContentBottom - viewportHeight);
      }

      const scrolled = contentHeight > 0 ? (winScroll / contentHeight) * 100 : 0;
      setScrollProgress(Math.min(scrolled, 100));
    };

    // Initial update
    handleScroll();

    // Add scroll event listener
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Add scrollend event listener if supported
    if ('onscrollend' in window) {
      window.addEventListener('scrollend', () => {
        // Update scroll state on scroll end
        handleScroll();
      });
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if ('onscrollend' in window) {
        window.removeEventListener('scrollend', () => {});
      }
    };
  }, []);

  return (
    <>
      <header
        ref={headerRef}
        className={`fixed top-0 z-[70] transition-all duration-300 ease-in-out will-change-transform`}
        style={{
          transform: 'translateZ(0)', // Force GPU acceleration
          left: '0px', // Always start from left edge like the editor
          right: '0px',
          width: '100%' // Always full width like the editor
        }}
        data-component="main-header"
        data-testid="main-header"
        data-sticky="true"
      >
        <div
          className="relative header-border-transition border-visible bg-background transition-all duration-300 ease-in-out"
          style={{
            height: `${headerHeight}px`,
            transform: 'translateZ(0)', // Force GPU acceleration
            willChange: 'height'
          }}
        >
          {/* Use the same layout approach as SidebarLayout for consistent spacing */}
          <div className="flex w-full h-full">
            {/* Sidebar spacer - only on desktop, matches SidebarLayout logic */}
            <div
              className="hidden md:block transition-all duration-300 ease-in-out flex-shrink-0"
              style={{ width: `${headerSidebarWidth}px` }}
            />

            {/* Header content area - matches editor content area */}
            <div className={`flex-1 min-w-0 flex items-center h-full px-3 sm:px-4 md:px-6 header-padding-mobile transition-all duration-300 ease-in-out`}>
              <div className="flex-1 flex items-center">
                {/* Auth navigation removed - functionality moved to UnifiedSidebar */}
              </div>

              {/* Logo/Title (centered) */}
              <div className="flex items-center justify-center">
                <Link href="/" className="flex items-center space-x-2 transition-all duration-200 hover:scale-105">
                  <Logo size="md" priority={true} clickable={true} styled={true} />
                </Link>
              </div>

              {/* Token Allocation Pie Chart (right side) */}
              <div className="flex-1 flex justify-end">
                {isPaymentsEnabled ? (
                  // Show token allocation pie chart if user has any token allocations (funded or unfunded)
                  renderTokenAllocationDisplay()
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1 bg-primary hover:bg-primary/90 text-white border-0"
                    onClick={() => openExternalLink('https://opencollective.com/wewrite-app', 'Header Support Button')}
                  >
                    <Heart className="h-4 w-4 text-white fill-white" />
                    <span>Support Us</span>
                  </Button>
                )}
              </div>
            </div>
          </div>

        </div>
      </header>
      {/* Spacer to prevent content from being hidden under the fixed header */}
      <div
        style={{
          height: `${headerHeight}px`,
          transition: 'height 300ms ease-in-out',
          transform: 'translateZ(0)', // Force GPU acceleration
          willChange: 'height'
        }}
      />

    </>
  );
}