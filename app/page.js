"use client";

/**
 * This is the main home page of the application.
 * For logged-in users, it renders the Home component which shows Recent Activity, Trending Pages, and Top Users.
 * For logged-out users, it renders the LandingPage component.
 */

import { useContext } from "react";
import { AuthContext } from "./providers/AuthProvider";
import { Loader } from "lucide-react";
import LandingPage from "./components/landing/LandingPage";
import SiteFooter from "./components/SiteFooter";
import Home from "./components/Home";

export default function HomePage() {
  const { user, loading: authLoading } = useContext(AuthContext);

  // Display a loading state while checking authentication
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader className="animate-spin h-8 w-8 text-primary"/>
      </div>
    );
  }

  // Show landing page for logged-out users
  if (!user) {
    return (
      <>
        <LandingPage />
        <SiteFooter />
      </>
    );
  }

  // Show home page for logged-in users
  return <Home />;
}
