"use client";

import BypassAuthPage from "./bypass-auth-page-fixed";

/**
 * This is a simple wrapper that renders the BypassAuthPage component.
 * The BypassAuthPage component completely bypasses authentication checks.
 */
export default function CreatePage() {
  // Simply render the BypassAuthPage component
  return <BypassAuthPage />;
}
