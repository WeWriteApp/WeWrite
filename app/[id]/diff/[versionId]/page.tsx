"use client";

import React, { use, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import PageView from '../../../components/pages/PageView';

interface PageDiffProps {
  params: Promise<{ id: string; versionId: string; }> | { id: string; versionId: string; };
}

function PageDiffContent({ params }: PageDiffProps) {
  // Handle both Promise and object params
  let unwrappedParams;

  // If params is a Promise, use React.use() to unwrap it
  if (params && typeof (params as any).then === 'function') {
    unwrappedParams = use(params as Promise<{ id: string; versionId: string; }>);
  } else {
    unwrappedParams = params as { id: string; versionId: string; };
  }

  const { id, versionId } = unwrappedParams;
  const searchParams = useSearchParams();
  const compareVersionId = searchParams?.get('compare'); // Get the comparison version from URL params

  return (
    <PageView
      params={{ id }}
      showDiff={true}
      versionId={versionId}
      {...(compareVersionId && { compareVersionId })}
    />
  );
}

export default function PageDiff({ params }: PageDiffProps) {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
    </div>}>
      <PageDiffContent params={params} />
    </Suspense>
  );
}