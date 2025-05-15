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
    if (!groupsEnabled) {
      console.log('[DEBUG] Group redirect page - Feature disabled, redirecting to home');
      router.push('/');
      return;
    }

    // If feature is enabled, redirect to the groups page
    router.push("/groups");
  }, [groupsEnabled, router]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
