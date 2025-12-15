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

/**
 * Look up user by username
 */
async function getUserByUsername(username: string) {
  const admin = getFirebaseAdmin();
  const db = admin.firestore();
  const usersCollection = db.collection(getCollectionName('users'));
  const usernameQuery = usersCollection.where('username', '==', username);
  const usernameSnapshot = await usernameQuery.get();

  if (!usernameSnapshot.empty) {
    const userDoc = usernameSnapshot.docs[0];
    return { id: userDoc.id, ...userDoc.data() };
  }

  return null;
}

interface UserLayoutProps {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ username: string }> }): Promise<Metadata> {
  try {
    const { username: usernameParam } = await params;

    // First try to find by username (primary lookup for /u/ route)
    let userData = await getUserByUsername(usernameParam);

    // Fallback: try by ID if username lookup fails (backwards compatibility)
    if (!userData) {
      userData = await getServerUserProfile(usernameParam);
    }

    if (userData) {
      const username = userData.username || 'User';

      return {
        title: `${username} on WeWrite`,
        description: `${username}'s profile on WeWrite`,
        openGraph: {
          title: `${username} on WeWrite`,
          description: `${username}'s profile on WeWrite`,
          url: `${process.env.NEXT_PUBLIC_BASE_URL}/u/${username}`,
          siteName: 'WeWrite',
          type: 'profile',
        },
        twitter: {
          card: 'summary',
          title: `${username} on WeWrite`,
          description: `${username}'s profile on WeWrite`,
        },
        alternates: {
          canonical: `${process.env.NEXT_PUBLIC_BASE_URL}/u/${username}`,
        },
      };
    }
  } catch (error) {
    console.error('Error generating metadata:', error);
  }

  return {
    title: 'User Profile - WeWrite',
    description: 'User profile on WeWrite',
  };
}

export default async function UserLayout({ children, params }: UserLayoutProps) {
  // Get the user data for schema markup
  let schemaMarkup = null;

  try {
    const { username: usernameParam } = await params;

    // First try to find by username (primary lookup for /u/ route)
    let userData = await getUserByUsername(usernameParam);

    // Fallback: try by ID if username lookup fails (backwards compatibility)
    if (!userData) {
      userData = await getServerUserProfile(usernameParam);
    }

    if (userData) {
      const username = userData.username || 'User';
      const bio = typeof userData.bio === 'string'
        ? userData.bio
        : Array.isArray(userData.bio)
          ? userData.bio.map((node: any) =>
              node.children?.map((child: any) => child.text || '').join('') || ''
            ).join(' ')
          : '';

      // Generate schema markup for Person
      schemaMarkup = {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: username,
        description: bio.substring(0, 160),
        url: `${process.env.NEXT_PUBLIC_BASE_URL}/u/${username}`,
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
