"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getPageById } from "../firebase/database/pages";
import { getDatabase, ref, get } from "firebase/database";
import { app } from "../firebase/config";
import PageView from '../components/pages/PageView';
import { SmartLoader } from '../components/ui/smart-loader';
import { ErrorDisplay } from '../components/ui/error-display';
import { Button } from '../components/ui/button';
import { useCurrentAccount } from '../providers/CurrentAccountProvider';

export default function ContentPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const router = useRouter();
  const { currentAccount, isLoading: authLoading } = useCurrentAccount();
  const currentAccountUid = currentAccount?.uid;
  const [contentType, setContentType] = useState<'page' | 'not-found' | 'error' | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [id, setId] = useState('');

  useEffect(() => {
    async function processParams() {
      try {
        // Handle params Promise or direct object
        let unwrappedParams;
        if (params && typeof (params as any).then === 'function') {
          unwrappedParams = await (params as Promise<{ id: string }>);
        } else {
          unwrappedParams = (params as { id: string }) || {};
        }

        let extractedId = unwrappedParams.id || '';

        // If the ID contains encoded slashes, decode them
        if (extractedId && extractedId.includes('%2F')) {
          extractedId = decodeURIComponent(extractedId);
        }

        // If the ID contains slashes, extract the first part
        if (extractedId && extractedId.includes('/')) {
          extractedId = extractedId.split('/')[0];
        }

        console.log('🔍 ContentPage: Extracted ID:', extractedId);
        setId(extractedId);
      } catch (error) {
        console.error('Error processing params:', error);
        setId('');
      }
    }

    processParams();
  }, [params]);

  useEffect(() => {
    if (!id) return;

    // Don't wait for auth for public pages - they should be accessible regardless
    // if (authLoading) return;

    async function determineContentType() {
      try {
        console.log('🔍 ContentPage: Determining content type for ID:', id);
        console.log('🔍 ContentPage: Auth loading:', authLoading, 'Current account:', currentAccountUid);

        // Validate the ID before making Firestore calls
        if (!id || typeof id !== 'string' || id.trim() === '') {
          console.error('Invalid ID provided:', id);
          setContentType('not-found');
          setIsLoading(false);
          return;
        }

        // Clean the ID and validate it's a proper Firestore document ID
        const cleanId = id.trim();
        if (cleanId.includes('/') || cleanId.includes('\\') || cleanId === '.' || cleanId === '..') {
          console.error('Invalid document ID format:', cleanId);
          setContentType('not-found');
          setIsLoading(false);
          return;
        }

        // Check if this is a deleted page preview request
        const urlParams = new URLSearchParams(window.location.search);
        const isPreviewingDeleted = urlParams.get('preview') === 'deleted';

        if (isPreviewingDeleted) {
          console.log('Deleted page preview requested, allowing page component to handle access control');
          setContentType('page');
          setIsLoading(false);
          return;
        }

        // First, check if it's a page using proper access control
        console.log('🔍 ContentPage: Checking if ID is a page:', cleanId);
        const pageResult = await getPageById(cleanId, currentAccountUid);
        console.log('🔍 ContentPage: Page result:', {
          hasPageData: !!pageResult.pageData,
          error: pageResult.error,
          pageTitle: pageResult.pageData?.title,
          fullPageResult: pageResult
        });

        if (pageResult.pageData) {
          console.log('🔍 ContentPage: Found valid page, setting contentType to page');
          setContentType('page');
          setIsLoading(false);
          return;
        } else if (pageResult.error && pageResult.error !== "Page not found") {
          console.log('🔍 ContentPage: Page error but not "not found", treating as page');
          setContentType('page');
          setIsLoading(false);
          return;
        }

        // If not a page, check if it's a user ID
        const rtdb = getDatabase(app);
        const userRef = ref(rtdb, `users/${cleanId}`);
        const userSnapshot = await get(userRef);

        if (userSnapshot.exists()) {
          window.location.href = `/user/${cleanId}`;
          return;
        }

        setContentType('not-found');
        setIsLoading(false);
      } catch (error) {
        console.error("Error determining content type:", error);
        setContentType('error');
        setIsLoading(false);
      }
    }

    determineContentType();
  }, [id, router, authLoading, currentAccountUid]);

  console.log('🔍 ContentPage: Render state check', {
    isLoading,
    contentType,
    id,
    authLoading,
    currentAccountUid
  });

  if (isLoading) {
    console.log('🔍 ContentPage: Showing SmartLoader because isLoading is true');
    return (
      <SmartLoader
        isLoading={isLoading}
        message="Loading content..."
        timeoutMs={10000}
        autoRecover={true}
        onRetry={() => window.location.reload()}
        fallbackContent={
          <div>
            <p>Loading page content...</p>
          </div>
        }
      />
    );
  }

  if (contentType === 'page') {
    console.log('🔍 ContentPage: Rendering PageView for ID:', id);
    return <PageView params={{ id }} />;
  }

  if (contentType === 'not-found') {
    // Temporarily disable dynamic import
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Page Not Found</h1>
          <p className="text-muted-foreground">The page you're looking for doesn't exist.</p>
        </div>
      </div>
    );
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
            onRetry={() => window.location.reload()}
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
          <p>We're having trouble loading this content.</p>
        </div>
      }
    />
  );
}