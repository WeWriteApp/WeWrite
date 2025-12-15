import { redirect } from 'next/navigation';
import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';

/**
 * Legacy /user/[id] route - redirects to new /u/[username] route
 *
 * This provides backwards compatibility for:
 * - Old shared links using /user/userId
 * - Old shared links using /user/username
 * - Bookmarks and external links
 *
 * Uses 301 permanent redirect for SEO
 */

interface UserPageProps {
  params: Promise<{ id: string }>;
}

async function getUsernameById(userId: string): Promise<string | null> {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();

    if (userDoc.exists) {
      const data = userDoc.data();
      return data?.username || null;
    }
    return null;
  } catch (error) {
    console.error('Error looking up user by ID:', error);
    return null;
  }
}

async function getUsernameByUsername(username: string): Promise<string | null> {
  try {
    const admin = getFirebaseAdmin();
    const db = admin.firestore();
    const usersCollection = db.collection(getCollectionName('users'));
    const usernameQuery = usersCollection.where('username', '==', username);
    const usernameSnapshot = await usernameQuery.get();

    if (!usernameSnapshot.empty) {
      const data = usernameSnapshot.docs[0].data();
      return data?.username || null;
    }
    return null;
  } catch (error) {
    console.error('Error looking up user by username:', error);
    return null;
  }
}

export default async function LegacyUserPage({ params }: UserPageProps) {
  const { id } = await params;

  // Try to find the username
  // First, check if 'id' is a Firebase UID (look up by document ID)
  let username = await getUsernameById(id);

  // If not found by ID, check if 'id' is already a username
  if (!username) {
    username = await getUsernameByUsername(id);
  }

  // If we found a username, redirect to the new route
  if (username) {
    redirect(`/u/${username}`);
  }

  // If user not found, still redirect to new route (let the new route handle 404)
  redirect(`/u/${id}`);
}
