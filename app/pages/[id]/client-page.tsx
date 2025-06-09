"use client";

import { use } from "react";
import SinglePageView from "../../components/pages/SinglePageView";

export default function ClientPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  // Handle both Promise and object params
  let unwrappedParams;
  try {
    // If params is a Promise, use React.use() to unwrap it
    if (params && typeof params.then === 'function') {
      unwrappedParams = use(params);
    } else {
      // If params is already an object, use it directly
      unwrappedParams = params || {};
    }
  } catch (error) {
    console.error("Error unwrapping params in ClientPage:", error);
    unwrappedParams = {};
  }

  const { id } = unwrappedParams;
  const validParams = { id: id || '' };
  return <SinglePageView params={validParams} />;
}
