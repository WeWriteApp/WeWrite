"use client";

import { useContext } from "react";
import { AuthContext } from "../providers/AuthProvider";
import { ShimmerEffect } from "../components/ui/skeleton";
import Link from "next/link";

export default function AccountLayout({ children }) {
  const { user, loading } = useContext(AuthContext);

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <ShimmerEffect className="h-8 w-60 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6">
          <ShimmerEffect className="h-40 w-full rounded-lg" />
          <ShimmerEffect className="h-80 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-6">Account</h1>
        <div className="bg-background/40 border-[1.5px] border-[rgba(255,255,255,0.1)] p-6 rounded-lg">
          <p className="mb-4">Please sign in to access your account.</p>
          <Link 
            href="/auth/login"
            className="inline-block px-4 py-2 bg-[#0057FF] hover:bg-[#0046CC] text-white rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const accountLinks = [
    { href: "/account", label: "Profile" },
    { href: "/account/subscription", label: "Subscription" },
    { href: "/account/pledges", label: "My Pledges" },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Account</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-[250px_1fr] gap-6">
        {/* Sidebar Navigation */}
        <div className="bg-background/40 border-[1.5px] border-[rgba(255,255,255,0.1)] p-4 rounded-lg h-fit">
          <nav>
            <ul className="space-y-1">
              {accountLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block px-3 py-2 rounded-md hover:bg-[rgba(255,255,255,0.1)] transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
        
        {/* Content Area */}
        <div>
          {children}
        </div>
      </div>
    </div>
  );
} 