"use client";

import SinglePageView from "../../components/pages/SinglePageView";

export default function ClientPage({ params }: { params: { id: string } }) {
  // Ensure we're passing a valid params object to SinglePageView
  const validParams = params || { id: '' };
  return <SinglePageView params={validParams} />;
}
