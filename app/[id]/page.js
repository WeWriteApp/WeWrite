"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { doc, getDoc } from 'firebase/firestore';
import { db } from "../firebase/config";
import { getDatabase, ref, get } from "firebase/database";
import { app } from "../firebase/config";
import ClientPage from '../pages/[id]/client-page.tsx';
import { Loader } from '../components/utils/Loader';
import { ErrorDisplay } from '../components/ui/error-display';
import { Button } from '../components/ui/button';
import { SmartLoader } from '../components/ui/smart-loader';
import { use } from "react";

export default function GlobalIDPage({ params }) {
  // Extract the ID from params and handle potential slashes
  // Check if params is a Promise or already an object
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
    console.error("Error unwrapping params:", error);
    unwrappedParams = {};
  }

  let { id } = unwrappedParams;

  // Ensure id is defined before processing
  if (!id) {
    console.error("ID is undefined in GlobalIDPage");
    id = '';
  }

  // If the ID contains encoded slashes, decode them
  if (id && id.includes('%2F')) {
    id = decodeURIComponent(id);
  }

  // If the ID contains slashes, extract the first part
  if (id && id.includes('/')) {
    id = id.split('/')[0];
  }

  const router = useRouter();
  const [contentType, setContentType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function determineContentType() {
      try {
        // First, check if it's a page
        const pageDoc = await getDoc(doc(db, "pages", id));
        if (pageDoc.exists()) {
          setContentType('page');
          setIsLoading(false);
          return;
        }

        // If not a page, check if it's a user ID
        const rtdb = getDatabase(app);
        const userRef = ref(rtdb, `users/${id}`);
        const userSnapshot = await get(userRef);

        if (userSnapshot.exists()) {
          // Redirect to the user page using direct navigation
          window.location.href = `/user/${id}`;
          return;
        }

        // If not a page or user, check if it's a group
        const groupRef = ref(rtdb, `groups/${id}`);
        const groupSnapshot = await get(groupRef);

        if (groupSnapshot.exists()) {
          // Redirect to the group page using direct navigation
          console.log('Group found, redirecting to group page');
          // Use direct navigation to avoid scroll issues with sticky headers
          window.location.href = `/group/${id}`;
          return;
        }

        // If we get here, the ID doesn't match any content
        // Use our wrapper component to trigger the not-found.tsx page
        setContentType('not-found');
        setIsLoading(false);
      } catch (error) {
        console.error("Error determining content type:", error);
        setContentType('error');
        setIsLoading(false);
      }
    }

    determineContentType();
  }, [id, router]);

  if (isLoading) {
    return (
      <SmartLoader
        isLoading={isLoading}
        message="Determining content type..."
        timeoutMs={10000}
        autoRecover={true}
        onRetry={() => {
          setIsLoading(true);
          determineContentType();
        }}
        fallbackContent={
          <div>
            <p>We're having trouble determining the content type. This could be due to:</p>
            <ul className="list-disc list-inside text-left mt-2 mb-2">
              <li>Slow network connection</li>
              <li>Server issues</li>
              <li>The content may not exist</li>
            </ul>
          </div>
        }
      />
    );
  }

  if (contentType === 'page') {
    return <ClientPage params={{ id }} />;
  }

  if (contentType === 'not-found') {
    // Import the NotFoundWrapper component
    const NotFoundWrapper = dynamic(() => import('../not-found-wrapper'), { ssr: false });
    return <NotFoundWrapper />;
  }

  if (contentType === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
        <div className="max-w-md w-full">
          <ErrorDisplay
            message="There was an error loading this content."
            severity="error"
            title="Content Error"
            showDetails={false}
            showRetry={true}
            onRetry={() => {
              // Use the error recovery utility to reset application state
              import('../utils/error-recovery').then(({ resetApplicationState }) => {
                resetApplicationState({
                  forceReload: true
                });
              }).catch(() => {
                // Fallback if import fails
                window.location.reload();
              });
            }}
            className="mb-6"
          />
          <div className="flex justify-center">
            <Button onClick={() => window.history.back()}>
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SmartLoader
      isLoading={true}
      message="Loading content..."
      timeoutMs={10000}
      autoRecover={true}
      onRetry={() => window.location.reload()}
      fallbackContent={
        <div>
          <p>We're having trouble loading this content. This could be due to:</p>
          <ul className="list-disc list-inside text-left mt-2 mb-2">
            <li>Slow network connection</li>
            <li>Server issues</li>
            <li>The content may not exist</li>
          </ul>
        </div>
      }
    />
  );
}
