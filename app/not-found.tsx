"use client";

import { useEffect } from "react";
import FullPageError from "./components/ui/FullPageError";

export default function NotFound() {
  // Add error logging to help debug the React error #185
  useEffect(() => {

    // Log current URL and referrer for debugging
    if (typeof window !== 'undefined') {
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