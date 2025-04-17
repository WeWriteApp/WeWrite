"use client";

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import SinglePageView with no SSR to ensure it only runs on client
const SinglePageView = dynamic(
  () => import("../../components/SinglePageView"),
  { ssr: false }
);

/**
 * ClientPage Component
 * This is a simple wrapper around SinglePageView that ensures proper client-side rendering
 * It's used by the GlobalIDPage component in app/[id]/page.js
 */
export default function ClientPage({ params }: { params: { id: string } }) {
  // Ensure we have a valid params object
  const validParams = params || { id: '' };

  // Use a simple div wrapper to ensure proper rendering context
  return (
    <div className="page-wrapper">
      <SinglePageView params={validParams} />
    </div>
  );
}
