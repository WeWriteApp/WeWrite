/**
 * Post-Deletion Navigation Utility
 * 
 * Provides graceful navigation after page deletion to prevent 404 errors
 * and ensure a smooth user experience.
 */

import { toast } from "../components/ui/use-toast";

// Type definitions
interface User {
  uid: string;
  username?: string;
  [key: string]: any;
}

interface Page {
  id: string;
  userId?: string;
  title?: string;
  [key: string]: any;
}

interface Router {
  push: (url: string) => void;
  replace: (url: string) => void;
  back: () => void;
  [key: string]: any;
}

/**
 * Navigate gracefully after page deletion
 * 
 * @param page - The deleted page object
 * @param user - Current user object (null if not authenticated)
 * @param router - Next.js router instance
 * @param showSuccessToast - Whether to show a success toast notification (default: true)
 */
export const navigateAfterPageDeletion = async (
  page: Page,
  user: User | null,
  router: Router,
  showSuccessToast: boolean = true
): Promise<void> => {
  try {
    console.log('🚀 Post-deletion navigation: Starting for page:', page.id);

    // Get the best navigation target based on referrer and history
    const navigationTarget = getBestNavigationTarget(page.id);

    if (navigationTarget) {
      console.log('🎯 Post-deletion navigation: Navigating to referrer:', navigationTarget);

      // Check if the target has a hash (tab navigation)
      const hasHash = navigationTarget.includes('#');
      if (hasHash) {
        const hashPart = navigationTarget.split('#')[1];
        console.log('🏷️ Post-deletion navigation: Preserving tab navigation to:', hashPart);
      }

      // Navigate to the determined target (preserves full URL including hash)
      router.replace(navigationTarget);
    } else {
      console.log('🏠 Post-deletion navigation: Using fallback to home page');
      // Fallback to home page if we can't determine a good target
      router.replace('/');
    }

    // Show success toast notification AFTER navigation starts
    if (showSuccessToast) {
      // Small delay to ensure navigation has started
      setTimeout(() => {
        toast.success("Page deleted successfully");
      }, 100);
    }
  } catch (error) {
    console.error("Error in post-deletion navigation:", error);
    // Emergency fallback to home page if anything goes wrong
    router.replace('/');
  }
};

/**
 * Get the best navigation target based on referrer and avoid the deleted page
 * Preserves full URL including search params and hash fragments (for tab navigation)
 */
const getBestNavigationTarget = (deletedPageId: string): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    // Check if we have a referrer (the page the user came from)
    if (document.referrer) {
      const referrerUrl = new URL(document.referrer);
      const referrerPath = referrerUrl.pathname;

      console.log('🔍 Post-deletion navigation: Checking referrer:', {
        fullUrl: document.referrer,
        path: referrerPath,
        search: referrerUrl.search,
        hash: referrerUrl.hash,
        deletedPageId
      });

      // Make sure the referrer is from the same origin (security)
      if (referrerUrl.origin === window.location.origin) {
        // Check if the referrer is NOT the page being deleted
        const deletedPagePattern = new RegExp(`^/(pages/)?${deletedPageId}(/|$)`);

        if (!deletedPagePattern.test(referrerPath)) {
          // Build the complete URL preserving search params and hash fragments
          const fullTargetUrl = referrerPath + referrerUrl.search + referrerUrl.hash;

          console.log('✅ Post-deletion navigation: Using referrer with full URL:', {
            targetUrl: fullTargetUrl,
            preservedHash: referrerUrl.hash,
            preservedSearch: referrerUrl.search
          });

          return fullTargetUrl;
        } else {
          console.log('🚫 Post-deletion navigation: Referrer is the deleted page, using fallback');
        }
      } else {
        console.log('🚫 Post-deletion navigation: Referrer is external origin, using fallback');
      }
    } else {
      console.log('🚫 Post-deletion navigation: No referrer available, using fallback');
    }

    // If no valid referrer, return null to use fallback
    return null;
  } catch (error) {
    console.error("Error determining navigation target:", error);
    return null;
  }
};



/**
 * Enhanced navigation for admin/moderation deletion interfaces
 * This variant is specifically for deletion actions performed by admins/moderators
 * 
 * @param page - The deleted page object
 * @param user - Current user object (admin/moderator)
 * @param router - Next.js router instance
 * @param returnToAdminPanel - Whether to return to admin panel (default: false)
 */
export const navigateAfterAdminPageDeletion = async (
  page: Page,
  user: User | null,
  router: Router,
  returnToAdminPanel: boolean = false
): Promise<void> => {
  try {
    if (returnToAdminPanel) {
      // Navigate to admin panel or moderation interface
      router.replace('/admin');
    } else {
      // Use standard post-deletion navigation with browser history support
      await navigateAfterPageDeletion(page, user, router, false);
    }

    // Show admin-specific success message AFTER navigation starts
    setTimeout(() => {
      toast.success("Page deleted by admin");
    }, 100);
  } catch (error) {
    console.error("Error in admin post-deletion navigation:", error);
    router.replace('/');
  }
};
