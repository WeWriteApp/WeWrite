"use client";

import { use } from "react";
import SinglePageView from "../../components/pages/SinglePageView";

export default function ClientPage({
  params,
  initialEditMode = false
}: {
  params: Promise<{ id: string }> | { id: string };
  initialEditMode?: boolean;
}) {
  // Handle both Promise and object params
  // Note: use() hook cannot be called inside try/catch blocks
  let unwrappedParams;

  // If params is a Promise, use React.use() to unwrap it
  if (params && typeof params.then === 'function') {
    unwrappedParams = use(params);
  } else {
    // If params is already an object, use it directly
    unwrappedParams = params || {};
  }

  const { id } = unwrappedParams;
  const validParams = { id: id || '' };
  return <SinglePageView params={validParams} initialEditMode={initialEditMode} />;
}
