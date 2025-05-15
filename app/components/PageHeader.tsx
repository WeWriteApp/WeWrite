"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "./ui/button";
import { Loader, ChevronLeft, Share2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/database";

import { getUsernameById, getUserSubscriptionTier } from "../utils/userUtils";
import { SupporterIcon } from "./SupporterIcon";
import { SubscriptionInfoModal } from "./SubscriptionInfoModal";

export interface PageHeaderProps {
  title?: string;
  username?: string;
  userId?: string;
  isLoading?: boolean;
  groupId?: string;
  groupName?: string;
  scrollDirection?: string;
  isPrivate?: boolean;
  tier?: string;
  subscriptionStatus?: string;
}

export default function PageHeader({
  title,
  username,
  userId,
  isLoading = false,
  groupId,
  groupName,
  // scrollDirection is not used but kept for compatibility
  isPrivate = false,
  tier: initialTier,
  subscriptionStatus: initialStatus,
}: PageHeaderProps) {
  const router = useRouter();
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [scrollProgress, setScrollProgress] = React.useState(0);
  const [headerHeight, setHeaderHeight] = React.useState(0);
  const headerRef = React.useRef<HTMLDivElement>(null);
  const spacerRef = React.useRef<HTMLDivElement>(null);
  const [displayUsername, setDisplayUsername] = React.useState<string>(username || "Anonymous");
  const [tier, setTier] = React.useState<string | null>(initialTier || null);
  const [subscriptionStatus, setSubscriptionStatus] = React.useState<string | null>(initialStatus || null);
  const [isLoadingTier, setIsLoadingTier] = React.useState<boolean>(false);
  const [subscriptionEnabled, setSubscriptionEnabled] = React.useState<boolean>(false);

  // Check if subscription feature is enabled
  React.useEffect(() => {
    const checkSubscriptionFeature = async () => {
      try {
        const featureFlagsRef = doc(db, 'config', 'featureFlags');
        const featureFlagsDoc = await getDoc(featureFlagsRef);

        if (featureFlagsDoc.exists()) {
          const flagsData = featureFlagsDoc.data();
          setSubscriptionEnabled(flagsData.subscription_management === true);
        }
      } catch (error) {
        console.error('Error checking subscription feature flag:', error);
      }
    };

    checkSubscriptionFeature();
  }, []);

  // Fetch username if not provided but userId is available
  React.useEffect(() => {
    const fetchTierInfo = async () => {
      if (userId) {
        try {
          setIsLoadingTier(true);
          const { tier: fetchedTier, status } = await getUserSubscriptionTier(userId);
          setTier(fetchedTier);
          setSubscriptionStatus(status);
        } catch (error) {
          console.error('Error fetching tier info:', error);
        } finally {
          setIsLoadingTier(false);
        }
      }
    };

    fetchTierInfo();
  }, [userId]);

  // Fetch username if not provided but userId is available
  React.useEffect(() => {
    const fetchUsername = async () => {
      // Always set a default username first
      setDisplayUsername(username || "Anonymous");

      // Then try to fetch the actual username if we have a userId
      if (userId) {
        try {
          console.log("Fetching username for userId:", userId);
          const fetchedUsername = await getUsernameById(userId);
          if (fetchedUsername && fetchedUsername !== "Anonymous") {
            setDisplayUsername(fetchedUsername);
            console.log("Username fetched for PageHeader:", fetchedUsername);
          }
        } catch (error) {
          console.error("Error fetching username for header:", error);
          // Keep the default username on error
        }
      }
    };

    fetchUsername();
  }, [userId, username]);

  // Calculate and update header height when component mounts or when title/isScrolled changes
  React.useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight;
        setHeaderHeight(height);

        // Also update spacer height directly to ensure immediate sync
        if (spacerRef.current) {
          spacerRef.current.style.height = `${height}px`;
        }
      }
    };

    // Initial update
    updateHeaderHeight();

    // Add resize listener to recalculate on window resize
    window.addEventListener('resize', updateHeaderHeight);

    // Create a MutationObserver to watch for changes to the header
    const observer = new MutationObserver(updateHeaderHeight);

    if (headerRef.current) {
      observer.observe(headerRef.current, {
        attributes: true,
        childList: true,
        subtree: true
      });
    }

    return () => {
      window.removeEventListener('resize', updateHeaderHeight);
      observer.disconnect();
    };
  }, [title, isScrolled]);

  React.useEffect(() => {
    // Use a throttled scroll handler for better performance
    let scrollTimeout: ReturnType<typeof setTimeout>;
    let lastScrollY = 0;
    let ticking = false;
    let spacerUpdateTimeout: ReturnType<typeof setTimeout>;

    const handleScroll = () => {
      lastScrollY = window.scrollY;

      // Use requestAnimationFrame for smoother performance
      if (!ticking) {
        window.requestAnimationFrame(() => {
          // Update scroll state - only change if needed
          const shouldBeScrolled = lastScrollY > 0;
          if (shouldBeScrolled !== isScrolled) {
            setIsScrolled(shouldBeScrolled);
          }

          // Calculate scroll progress
          const windowHeight = window.innerHeight;
          const documentHeight = document.documentElement.scrollHeight;
          const maxScroll = documentHeight - windowHeight;
          const progress = (lastScrollY / maxScroll) * 100;
          setScrollProgress(Math.min(progress, 100));

          // Update the spacer height immediately to ensure proper spacing
          if (headerRef.current && spacerRef.current) {
            const height = headerRef.current.offsetHeight;
            spacerRef.current.style.height = `${height}px`;
          }

          ticking = false;
        });

        ticking = true;
      }
    };

    // Initial call to set up the spacer height
    if (headerRef.current && spacerRef.current) {
      const height = headerRef.current.offsetHeight;
      spacerRef.current.style.height = `${height}px`;
    }

    // Use passive event listener for better performance
    window.addEventListener("scroll", handleScroll, { passive: true });

    // Also add scrollend event listener for modern browsers
    const handleScrollEnd = () => {
      // When scrolling stops, check if we're at the top
      if (window.scrollY < 5) {
        // Force scroll to absolute top to avoid partial header overlay
        window.scrollTo({top: 0, behavior: 'instant'});
      }

      // Update spacer height after scrolling stops
      if (headerRef.current && spacerRef.current) {
        const height = headerRef.current.offsetHeight;
        spacerRef.current.style.height = `${height}px`;
      }
    };

    if ('onscrollend' in window) {
      window.addEventListener('scrollend', handleScrollEnd);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      if (spacerUpdateTimeout) {
        clearTimeout(spacerUpdateTimeout);
      }
      if ('onscrollend' in window) {
        window.removeEventListener('scrollend', handleScrollEnd);
      }
    };
  }, [isScrolled]);

  // Function to handle back button click
  const handleBackClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // Check if we're on a history page
    const pathname = window.location.pathname;
    if (pathname.includes('/history')) {
      // Extract the page ID from the URL
      const pageId = pathname.split('/')[1];
      if (pageId) {
        // Navigate to the page
        router.push(`/${pageId}`);
        return;
      }
    }

    // Check if we came from a user page or home
    if (document.referrer.includes('/user/')) {
      // Extract user ID from referrer and navigate to that user's page
      const referrer = new URL(document.referrer);
      const userPath = referrer.pathname.split('/');
      if (userPath.length >= 3) {
        const userId = userPath[2];
        router.push(`/user/${userId}`);
        return;
      }
    }

    // Default to home page
    router.push('/');
  };

  return (
    <>
      <header
        ref={headerRef}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-out will-change-transform header-border-transition ${
          isScrolled
            ? "bg-background/80 backdrop-blur-sm shadow-sm"
            : "bg-background border-visible"
        }`}
        style={{
          transform: 'translateZ(0)', // Force GPU acceleration
          width: '100%'
        }}
      >
        <div className="relative mx-auto px-2 md:px-4">
          <div className={`flex items-center justify-between ${isScrolled ? 'py-0.5' : 'py-1'}`}>
            {/* Left Side - Back Button */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className={`md:mr-2 text-foreground transition-opacity duration-120 ${
                  isScrolled ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
                onClick={handleBackClick}
                title="Go back"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>

            {/* Center - Title and Author */}
            <div
              className={`flex-1 flex justify-center items-center ${isScrolled ? "cursor-pointer" : ""}`}
              onClick={isScrolled ? () => window.scrollTo({ top: 0, behavior: 'smooth' }) : undefined}
            >
              <div
                className={`text-center space-y-0 transition-all duration-200 ease-out will-change-transform ${
                  isScrolled ? "flex flex-row items-center gap-2 pl-0" : "max-w-full"
                }`}
                style={{
                  transform: isScrolled ? "translateY(0)" : "translateY(0)",
                  maxWidth: isScrolled ? "calc(100% - 16px)" : "100%",
                  margin: isScrolled ? "0 8px" : "0"
                }}
              >
                <h1
                  className={`font-semibold transition-all duration-200 ease-out will-change-transform ${
                    isScrolled
                      ? "text-xs opacity-90"
                      : "text-2xl mb-0.5"
                  }`}
                  style={{
                    maxWidth: isScrolled ? "70vw" : "100%"
                  }}
                >
                  {isLoading ? (
                    <div className="flex items-center space-x-2">
                      <Loader className="h-4 w-4 animate-spin" />
                      <span className="text-muted-foreground">Loading title...</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <span
                        className={isScrolled ? "text-ellipsis overflow-hidden" : ""}
                        style={isScrolled ? {
                          maxWidth: '60vw',
                          display: 'inline-block',
                          verticalAlign: 'middle',
                          whiteSpace: 'nowrap',
                          paddingRight: '4px'
                        } : {}}
                      >
                        {title || "Untitled"}
                      </span>
                      {isPrivate && <Lock className={`${isScrolled ? 'h-3 w-3' : 'h-4 w-4'} text-muted-foreground flex-shrink-0`} />}
                    </div>
                  )}
                </h1>
                <p
                  className={`text-muted-foreground transition-all duration-200 ease-out will-change-transform ${
                    isScrolled
                      ? "text-xs mt-0 whitespace-nowrap overflow-hidden text-ellipsis inline-block"
                      : "text-sm mt-0.5"
                  }`}
                  style={{
                    maxWidth: isScrolled ? "25vw" : "100%",
                    minWidth: isScrolled ? "auto" : "auto"
                  }}
                >
                  {isLoading ? (
                    <span className="inline-flex items-center"><Loader className="h-3 w-3 animate-spin mr-1" />Loading author...</span>
                  ) : (
                    groupId && groupName ? (
                      <Link href={`/group/${groupId}`} className="hover:underline">
                        <span data-component-name="PageHeader">in {groupName}</span>
                      </Link>
                    ) : (
                      <span className="flex items-center gap-1 justify-center mx-auto">
                        <span className="whitespace-nowrap flex-shrink-0">by</span>
                        <Link href={`/user/${userId}`} className="hover:underline overflow-hidden text-ellipsis">
                          {isLoading || !displayUsername ? (
                            <span className="inline-flex items-center text-muted-foreground"><Loader className="h-3 w-3 animate-spin mr-1" />Loading...</span>
                          ) : (
                            <span data-component-name="PageHeader" className="overflow-hidden text-ellipsis">{displayUsername}</span>
                          )}
                        </Link>
                        {subscriptionEnabled && (
                          <SubscriptionInfoModal currentTier={tier} currentStatus={subscriptionStatus} userId={userId} username={displayUsername && displayUsername !== 'Anonymous' ? displayUsername : undefined}>
                            <div className="cursor-pointer flex-shrink-0 flex items-center">
                              <SupporterIcon tier={tier} status={subscriptionStatus} size="sm" />
                            </div>
                          </SubscriptionInfoModal>
                        )}
                      </span>
                    )
                  )}
                </p>
              </div>
            </div>

            {/* Right Side - Share Button (only visible when not scrolled) */}
            <div className="flex items-center">
              <Button
                variant="outline"
                size="icon"
                className={`text-foreground transition-opacity duration-120 ${
                  isScrolled ? "opacity-0 pointer-events-none" : "opacity-100"
                }`}
                onClick={() => {
                  // Create Twitter share text in the format: "[title]" by [username] on @WeWriteApp [URL]
                  const pageTitle = title || 'WeWrite Page';
                  const pageUrl = window.location.href;
                  const twitterText = `"${pageTitle}" by ${displayUsername} on @WeWriteApp ${pageUrl}`;

                  // Check if the Web Share API is available
                  if (navigator.share) {
                    navigator.share({
                      title: pageTitle,
                      text: twitterText,
                      url: pageUrl,
                    }).catch((error) => {
                      // Silent error handling - no toast
                      console.error('Error sharing:', error);
                    });
                  } else {
                    // Create a Twitter share URL as fallback
                    try {
                      // First try to open Twitter share dialog
                      const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(twitterText)}`;
                      window.open(twitterShareUrl, '_blank', 'noopener,noreferrer');
                    } catch (error) {
                      console.error('Error opening Twitter share:', error);

                      // If that fails, copy the URL to clipboard
                      try {
                        navigator.clipboard.writeText(pageUrl);
                      } catch (clipboardError) {
                        console.error('Error copying link:', clipboardError);
                      }
                    }
                  }
                }}
                title="Share"
              >
                <Share2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
          {/* Scroll Progress Bar */}
          <div
            className="absolute bottom-0 left-0 h-0.5 bg-primary transition-all duration-120"
            style={{ width: `${scrollProgress}%` }}
          />
        </div>
      </header>
      {/* Add spacer to prevent content from being hidden under the fixed header */}
      <div ref={spacerRef} style={{ height: headerHeight + 'px' }} />
    </>
  );
}