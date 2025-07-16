import { getFirebaseAdmin } from '../../firebase/firebaseAdmin';
import { getCollectionName } from '../../utils/environmentConfig';
import { Metadata } from 'next';

/**
 * Server-safe user profile loading (no client-side caching)
 */
async function getServerUserProfile(userId: string) {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();

  const userDoc = await db.collection(getCollectionName('users')).doc(userId).get();

  if (userDoc.exists) {
    return { id: userDoc.id, ...userDoc.data() };
  }

  return null;
}

interface UserLayoutProps {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  try {
    const { id } = await params;

    // First, try to get user by ID directly using server-safe profile loading
    let userData = await getServerUserProfile(id);
    let userId = id;

    if (!userData) {
      // If not found by ID, try to find by username in environment-aware collection
      const admin = getFirebaseAdmin();
      const db = admin.firestore();
      const usersCollection = db.collection(getCollectionName('users'));
      const usernameQuery = usersCollection.where('username', '==', id);
      const usernameSnapshot = await usernameQuery.get();

      if (!usernameSnapshot.empty) {
        // Found user by username
        const userDoc = usernameSnapshot.docs[0];
        userData = { id: userDoc.id, ...userDoc.data() };
        userId = userDoc.id;
      }
    }

    if (userData) {
      const username = userData.username || 'User';

      return {
        title: `${username} on WeWrite`,
        description: `${username}'s profile on WeWrite`,
        openGraph: {
          title: `${username} on WeWrite`,
          description: `${username}'s profile on WeWrite`,
          url: `${process.env.NEXT_PUBLIC_BASE_URL}/user/${id}`,
          siteName: 'WeWrite',
          type: 'profile'},
        twitter: {
          card: 'summary',
          title: `${username} on WeWrite`,
          description: `${username}'s profile on WeWrite`}
      };
    }
  } catch (error) {
    console.error('Error generating metadata:', error);
  }

  return {
    title: 'User Profile - WeWrite',
    description: 'User profile on WeWrite'};
}

export default async function UserLayout({ children, params }: UserLayoutProps) {
  // Get the user data for schema markup
  let schemaMarkup = null;

  try {
    const { id } = await params;

    // First, try to get user by ID directly using server-safe profile loading
    let userData = await getServerUserProfile(id);
    let userId = id;

    if (!userData) {
      // If not found by ID, try to find by username in environment-aware collection
      const admin = getFirebaseAdmin();
      const db = admin.firestore();
      const usersCollection = db.collection(getCollectionName('users'));
      const usernameQuery = usersCollection.where('username', '==', id);
      const usernameSnapshot = await usernameQuery.get();

      if (!usernameSnapshot.empty) {
        // Found user by username
        const userDoc = usernameSnapshot.docs[0];
        userData = { id: userDoc.id, ...userDoc.data() };
        userId = userDoc.id;
      }
    }

    if (userData) {
      const username = userData.username || 'User';
      const bio = typeof userData.bio === 'string'
        ? userData.bio
        : Array.isArray(userData.bio)
          ? userData.bio.map(node =>
              node.children?.map(child => child.text || '').join('') || ''
            ).join(' ')
          : '';

      // Generate schema markup for Person
      schemaMarkup = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: username,
        description: bio.substring(0, 160),
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/user/${id}`
      };
    }
  } catch (error) {
    console.error('Error generating schema markup for user:', error);
  }

  return (
    <>
      {schemaMarkup && (
        <script
          id="schema-markup"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaMarkup) }}
        />
      )}
      {children}
    </>
  );
}