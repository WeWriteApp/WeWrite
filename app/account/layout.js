"use client";

import { useContext } from "react";
import { AuthContext } from "../../providers/AuthProvider";
import { PageLoader } from "../components/ui/page-loader";
import { useRouter } from "next/navigation";

export default function AccountLayout({ children }) {
  const { loading } = useContext(AuthContext);

  if (loading) {
    return <PageLoader message="Loading account settings..." />;
  }

  // Just render children without any container UI
  return <>{children}</>;
}