"use client";

import { useEffect, useContext } from "react";
import { useRouter } from "next/navigation";
import { Loader } from "lucide-react";
import { useFeatureFlag } from "../utils/feature-flags";
import { AuthContext } from "../providers/AuthProvider";

export default function GroupRedirectPage() {
  const router = useRouter();
  const { user } = useContext(AuthContext);
  const groupsEnabled = useFeatureFlag('groups', user?.email);

  useEffect(() => {
    console.log('[DEBUG] Group redirect page - Feature status:', groupsEnabled);

    // Always redirect to the groups page, regardless of feature flag
    // This ensures consistent navigation behavior
    console.log('[DEBUG] Group redirect page - Redirecting to groups page');

    try {
      // Use window.location for more reliable navigation
      window.location.href = '/groups';
    } catch (error) {
      console.error('[DEBUG] Group redirect page - Error navigating:', error);
      // Fallback to router.push
      router.push('/groups');
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
