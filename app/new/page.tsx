"use client";

import React, { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { NewPageSkeleton } from "../components/skeletons/PageEditorSkeleton";
import { buildNewPageUrl } from "../utils/pageId";

/**
 * /new page - Legacy redirect
 *
 * This page now redirects to /{pageId}?new=true for backwards compatibility.
 * All new page creation is handled directly in ContentPageView.
 *
 * Preserves URL parameters for replies, daily notes, etc.
 */
function NewPageRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Build the new URL with all existing parameters
    const options: any = {};

    // Preserve all URL parameters
    const replyTo = searchParams?.get('replyTo');
    const replyToTitle = searchParams?.get('page');
    const replyToUsername = searchParams?.get('username') || searchParams?.get('pageUsername');
    const replyType = searchParams?.get('replyType');
    const pageUserId = searchParams?.get('pageUserId');
    const groupId = searchParams?.get('groupId');
    const customDate = searchParams?.get('customDate');
    const urlTitle = searchParams?.get('title');
    const urlContent = searchParams?.get('content');
    const initialContentParam = searchParams?.get('initialContent');
    const pageType = searchParams?.get('type');
    const ideas = searchParams?.get('ideas');

    if (replyTo) options.replyTo = replyTo;
    if (replyToTitle) options.replyToTitle = decodeURIComponent(replyToTitle);
    if (replyToUsername) options.replyToUsername = decodeURIComponent(replyToUsername);
    if (replyType) options.replyType = replyType;
    if (pageUserId) options.pageUserId = pageUserId;
    if (groupId) options.groupId = groupId;
    if (customDate) options.customDate = customDate;
    if (urlTitle) options.title = urlTitle;
    if (urlContent) options.content = urlContent;
    if (initialContentParam) {
      try {
        options.initialContent = JSON.parse(decodeURIComponent(initialContentParam));
      } catch {
        // Ignore parse errors
      }
    }
    if (pageType) options.type = pageType;
    if (ideas === 'true') options.ideas = true;

    // Generate new page URL and redirect
    const newUrl = buildNewPageUrl(options);
    console.log('🔄 Redirecting /new to:', newUrl);

    // Use replace to avoid /new appearing in browser history
    router.replace(newUrl);
  }, [router, searchParams]);

  // Show loading state during redirect
  return <NewPageSkeleton />;
}

export default function NewPage() {
  return (
    <Suspense fallback={<NewPageSkeleton />}>
      <NewPageRedirect />
    </Suspense>
  );
}
