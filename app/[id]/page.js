"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getDatabase, ref, get } from 'firebase/database';
import { app } from '../firebase/config';
import ClientPage from '../pages/[id]/client-page';
import { Loader } from '../components/Loader';

export default function GlobalIDPage({ params }) {
  // Extract the ID from params and handle potential slashes
  let { id } = params;

  // If the ID contains encoded slashes, decode them
  if (id.includes('%2F')) {
    id = decodeURIComponent(id);
  }

  // If the ID contains slashes, extract the first part
  if (id.includes('/')) {
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
          // Redirect to the user page
          router.replace(`/user/${id}`);
          return;
        }

        // If not a page or user, check if it's a group
        const groupRef = ref(rtdb, `groups/${id}`);
        const groupSnapshot = await get(groupRef);

        if (groupSnapshot.exists()) {
          // Redirect to the group page
          router.replace(`/group/${id}`);
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
    return <Loader />;
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
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p className="text-muted-foreground">There was an error loading this content. Please try again later.</p>
      </div>
    );
  }

  return <Loader />;
}
