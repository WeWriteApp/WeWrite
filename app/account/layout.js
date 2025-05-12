"use client";

import { useContext, useEffect } from "react";
import { AuthContext } from "../providers/AuthProvider";
import { PageLoader } from "../components/ui/page-loader";
import { useRouter } from "next/navigation";

export default function AccountLayout({ children }) {
  const { loading, isAuthenticated } = useContext(AuthContext);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/auth/login?redirect=/account');
    }
  }, [loading, isAuthenticated, router]);

  if (loading) {
    return <PageLoader message="Loading account settings..." />;
  }

  // Just render children without any container UI
  return <>{children}</>;
}