"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from "../../firebase/config";
import PageView from '../../components/pages/PageView';
import { SmartLoader } from '../../components/ui/smart-loader';
import { use } from "react";

export default function EditPage({ params }) {
  // Extract the ID from params and handle potential slashes
  // Note: use() hook cannot be called inside try/catch blocks
  let unwrappedParams;

  // If params is a Promise, use React.use() to unwrap it
  if (params && typeof params.then === 'function') {
    unwrappedParams = use(params);
  } else {
    // If params is already an object, use it directly
    unwrappedParams = params || {};
  }

  let { id } = unwrappedParams;

  // Ensure id is defined before processing
  if (!id) {
    console.error("ID is undefined in EditPage");
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
  const [pageExists, setPageExists] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkPageExists = async () => {
    try {
      // Check if the page exists
      const pageDoc = await getDoc(doc(db, "pages", id));
      if (pageDoc.exists()) {
        const pageData = pageDoc.data();

        // CRITICAL: Check if page is soft-deleted
        // Only page owners can edit their own deleted pages through the "Recently Deleted Pages" section
        if (pageData.deleted === true) {
          // For deleted pages, redirect to 404 for all users
          // Edit mode should not be accessible for deleted pages
          console.log(`Edit access denied to deleted page ${id}`);
          router.replace('/404');
          return;
        }

        setPageExists(true);
      } else {
        // Page doesn't exist, redirect to 404
        router.replace('/404');
        return;
      }
      setIsLoading(false);
    } catch (error) {
      console.error("Error checking page existence:", error);
      // On error, redirect to the normal page view
      router.replace(`/${id}`);
    }
  };

  useEffect(() => {

    if (id) {
      checkPageExists();
    }
  }, [id, router]);

  if (isLoading) {
    return (
      <SmartLoader
        isLoading={isLoading}
        message="Loading edit mode..."
        timeoutMs={10000}
        autoRecover={true}
        onRetry={() => {
          setIsLoading(true);
          checkPageExists();
        }}
        fallbackContent={
          <div>
            <p>We're having trouble loading the edit mode. This could be due to:</p>
            <ul className="list-disc list-inside text-left mt-2 mb-2">
              <li>Slow network connection</li>
              <li>Server issues</li>
              <li>The page may not exist</li>
            </ul>
          </div>
        }
      />
    );
  }

  if (pageExists) {
    // Pass a special prop to indicate this is edit mode
    return <PageView params={{ id }} initialEditMode={true} />;
  }

  return null;
}