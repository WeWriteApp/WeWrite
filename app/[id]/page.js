"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getDatabase, ref, get } from 'firebase/database';
import { app } from '../firebase/config';
import dynamic from 'next/dynamic';
import { Loader } from '../components/Loader';

// Dynamically import ClientPage to ensure it only loads on the client side
const ClientPage = dynamic(
  () => import('../pages/[id]/client-page.tsx'),
  { ssr: false }
);

/**
 * GlobalIDPage Component
 * This component handles routing based on the ID parameter
 * It determines if the ID belongs to a page, user, or group and routes accordingly
 */
export default function GlobalIDPage({ params }) {
  const { id } = params;
  const router = useRouter();
  const [contentType, setContentType] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageData, setPageData] = useState(null);

  useEffect(() => {
    // Safety check for id
    if (!id) {
      setContentType('not-found');
      setIsLoading(false);
      return;
    }

    async function determineContentType() {
      try {
        console.log("Determining content type for ID:", id);

        // First, check if it's a page
        const pageDoc = await getDoc(doc(db, "pages", id));
        if (pageDoc.exists()) {
          console.log("Found page with ID:", id);
          setContentType('page');
          setPageData(pageDoc.data());
          setIsLoading(false);
          return;
        }

        // If not a page, check if it's a user ID
        const rtdb = getDatabase(app);
        const userRef = ref(rtdb, `users/${id}`);
        const userSnapshot = await get(userRef);

        if (userSnapshot.exists()) {
          console.log("Found user with ID:", id);
          // Redirect to the user page
          router.replace(`/user/${id}`);
          return;
        }

        // If not a page or user, check if it's a group
        const groupRef = ref(rtdb, `groups/${id}`);
        const groupSnapshot = await get(groupRef);

        if (groupSnapshot.exists()) {
          console.log("Found group with ID:", id);
          // Redirect to the group page
          router.replace(`/group/${id}`);
          return;
        }

        // If we get here, the ID doesn't match any content
        console.log("No content found for ID:", id);
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
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader />
      </div>
    );
  }

  if (contentType === 'page') {
    // Ensure we're passing a valid params object with id to ClientPage
    return (
      <div className="page-container">
        <ClientPage params={{ id }} />
      </div>
    );
  }

  if (contentType === 'not-found') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h1 className="text-2xl font-bold mb-4">Content Not Found</h1>
        <p className="text-muted-foreground">The content you're looking for doesn't exist.</p>
      </div>
    );
  }

  if (contentType === 'error') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-muted-foreground">There was an error loading this content. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader />
    </div>
  );
}
