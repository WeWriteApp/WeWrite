"use client";

import React, { use } from 'react';
import VersionDetailView from '../../../components/pages/VersionDetailView';

export default function PageVersionView({ params }: { params: Promise<{ id: string, versionId: string }> | { id: string, versionId: string } }) {
  // Handle both Promise and object params
  let unwrappedParams;

  // If params is a Promise, use React.use() to unwrap it
  if (params && typeof (params as any).then === 'function') {
    unwrappedParams = use(params as Promise<{ id: string; versionId: string; }>);
  } else {
    unwrappedParams = params as { id: string; versionId: string; };
  }

  const { id, versionId } = unwrappedParams;

  return (
    <VersionDetailView
      pageId={id}
      versionId={versionId}
    />
  );
}