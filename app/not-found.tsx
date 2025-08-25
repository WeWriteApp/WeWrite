"use client";

import { useEffect } from "react";
import FullPageError from "./components/ui/FullPageError";

export default function NotFound() {
  // Add error logging to help debug the React error #185
  useEffect(() => {
    console.log('🔍 NotFound page mounted');

    // Log current URL and referrer for debugging
    if (typeof window !== 'undefined') {
      console.log('🔍 NotFound page details:', {
        url: window.location.href,
        referrer: document.referrer,
        timestamp: new Date().toISOString()
      });
    }
  }, []);

  return (
    <FullPageError
      title="404 - Page Not Found"
      message="Sorry, we couldn't find the page you're looking for."
      showGoBack={true}
      showGoHome={true}
      showTryAgain={false}
    />
  );
}