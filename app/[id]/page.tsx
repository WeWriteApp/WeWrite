import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getDatabase, ref, get } from 'firebase/database';
import { app } from '../firebase/config';
import { redirect } from 'next/navigation';
import ClientPage from '../pages/[id]/client-page';

export default async function GlobalIDPage({ params }: { params: { id: string } }) {
  const { id } = params;
  let contentType = null;

  try {
    // First, check if it's a page
    const pageDoc = await getDoc(doc(db, "pages", id));
    if (pageDoc.exists()) {
      contentType = 'page';
    } else {
      // If not a page, check if it's a user ID
      const rtdb = getDatabase(app);
      const userRef = ref(rtdb, `users/${id}`);
      let userSnapshot;

      try {
        userSnapshot = await get(userRef);
      } catch (userError) {
        console.error("Error checking if ID is a user:", userError);
        // Continue to check if it's a group
      }

      if (userSnapshot && userSnapshot.exists()) {
        // Redirect to the user page
        redirect(`/user/${id}`);
      }

      // If not a page or user, check if it's a group
      const groupRef = ref(rtdb, `groups/${id}`);
      let groupSnapshot;

      try {
        groupSnapshot = await get(groupRef);
      } catch (groupError) {
        console.error("Error checking if ID is a group:", groupError);
        // Continue to not-found
      }

      if (groupSnapshot && groupSnapshot.exists()) {
        // Redirect to the group page
        redirect(`/group/${id}`);
      }

      // If we get here, the ID doesn't match any content
      contentType = 'not-found';
    }
  } catch (error) {
    console.error("Error determining content type:", error);
    contentType = 'error';
  }

  if (contentType === 'page') {
    return <ClientPage params={{ id }} />;
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

  // Fallback loading state
  return (
    <div className="flex justify-center items-center min-h-[50vh]">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
    </div>
  );
}
