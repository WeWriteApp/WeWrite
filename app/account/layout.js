"use client";

import { useContext } from "react";
import { AuthContext } from "../providers/AuthProvider";
import { ShimmerEffect } from "../components/ui/skeleton";
import { useRouter } from "next/navigation";

export default function AccountLayout({ children }) {
  const { loading } = useContext(AuthContext);
  
  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <ShimmerEffect className="h-8 w-60 mb-6" />
        <div>
          <ShimmerEffect className="h-12 w-full rounded-lg mb-6" />
          <ShimmerEffect className="h-80 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  // Just render children without any container UI
  return <>{children}</>;
} 