"use client";

import SinglePageView from "../../components/SinglePageView";

// This component is used by the main page component in app/[id]/page.js
// It should not be directly accessed via a route
export default function ClientPage({ params }: { params: { id: string } }) {
  // Ensure we're passing a valid params object to SinglePageView
  const validParams = params || { id: '' };
  return <SinglePageView params={validParams} />;
}
