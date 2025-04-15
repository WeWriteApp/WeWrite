"use client";

import DirectCreatePage from "./direct-page";

/**
 * This is a simple wrapper that renders the DirectCreatePage component.
 * The DirectCreatePage component directly uses Firebase auth and bypasses all the complex authentication checks.
 */
export default function CreatePage() {
  // Simply render the DirectCreatePage component
  return <DirectCreatePage />;
}
