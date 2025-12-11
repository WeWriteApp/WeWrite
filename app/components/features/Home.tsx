"use client";
import { useEffect, useState, useRef } from "react";
import { useAuth } from '../../providers/AuthProvider';
import { useBanner } from '../../providers/BannerProvider';
import { useRouter } from "next/navigation";
import Link from "next/link";

// Removed useOptimizedHome - now using UnifiedRecentActivity
import { Activity } from "lucide-react";
import GlobalRecentEdits from "./GlobalRecentEdits";
import DailyNotesSection from "../daily-notes/DailyNotesSection";
import EmptyState from "../ui/EmptyState";
import { getEnvironmentType } from "../../utils/environmentConfig";
import { EmailVerificationModal } from "../auth/EmailVerificationModal";




const Home: React.FC = () => {
  console.log('🏠 [HOME_COMPONENT] Rendering - timestamp:', new Date().toISOString());
  const { user, isAuthenticated, isLoading } = useAuth();
  const { bannerOffset } = useBanner();
  console.log('🏠 [HOME_COMPONENT] Auth state:', { isAuthenticated, isLoading, hasCurrentAccount: !!user });
  const router = useRouter();
  // Removed recentEditsFilterState - now handled by UnifiedRecentActivity component

  // State for email verification modal
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [isAdminTestingMode, setIsAdminTestingMode] = useState(false);

  // Check if we should show the verification modal
  useEffect(() => {
    if (typeof window === 'undefined' || !user) return;

    const checkVerificationState = () => {
      const adminOverride = localStorage.getItem('wewrite_admin_email_banner_override') === 'true';
      const verificationDismissed = localStorage.getItem('wewrite_email_verification_dismissed') === 'true';

      setIsAdminTestingMode(adminOverride);

      // Show modal for real unverified users (no dismiss option)
      if (!user.emailVerified) {
        setShowVerificationModal(true);
        return;
      }

      // Show modal for admin testing mode if not dismissed
      if (adminOverride && !verificationDismissed) {
        setShowVerificationModal(true);
        return;
      }

      setShowVerificationModal(false);
    };

    checkVerificationState();

    // Listen for storage changes
    const handleStorageChange = () => {
      checkVerificationState();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('bannerOverrideChange', handleStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bannerOverrideChange', handleStorageChange);
    };
  }, [user]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/auth/login");
    }
  }, [isAuthenticated, isLoading]);

  // Show progressive loading state while authentication is being determined - show page structure immediately
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">


        {/* Show page structure immediately */}
        <div className="container max-w-4xl mx-auto px-4 pt-20 py-6">
          {/* Daily notes section skeleton */}
          <div className="mb-8">
            <div className="h-6 w-32 bg-muted rounded animate-pulse mb-4" />
            <div className="h-20 bg-muted rounded-xl animate-pulse" />
          </div>

          {/* Recent activity section skeleton */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-muted-foreground" />
              <div className="h-6 w-40 bg-muted rounded animate-pulse" />
            </div>
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Only redirect if we're sure the user is not authenticated
  if (!isLoading && !isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Email verification modal - blocks access until verified */}
      {showVerificationModal && (
        <EmailVerificationModal
          showDismissButton={isAdminTestingMode && user?.emailVerified}
          onDismiss={() => setShowVerificationModal(false)}
        />
      )}

      {/* Main content area with proper sidebar spacing */}
      <main
        className="transition-all duration-300 ease-in-out"
        style={{
          paddingTop: typeof window !== 'undefined' && window.innerWidth < 768
            ? `${72 + bannerOffset}px`
            : undefined
        }}
      >
          <div className="container max-w-4xl mx-auto py-4 space-y-6">
            {/* Daily Notes Section */}
            <DailyNotesSection />

            {/* Recent Edits Section - with horizontal padding */}
            <div className="px-4">
              <GlobalRecentEdits />
            </div>






          </div>
        </main>
    </div>
  );
};

export default Home;