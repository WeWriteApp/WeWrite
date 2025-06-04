import { getDatabase, ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { app } from '../../firebase/config';
import Script from 'next/script';

export async function generateMetadata({ params }) {
  try {
    const { id } = await params;
    const rtdb = getDatabase(app);

    // First, try to get user by ID directly
    const userByIdRef = ref(rtdb, `users/${id}`);
    const userByIdSnapshot = await get(userByIdRef);

    if (userByIdSnapshot.exists()) {
      const userData = userByIdSnapshot.val();
      const displayName = userData.displayName || userData.username || 'User';

      return {
        title: `${displayName} on WeWrite`,
        description: `${displayName}'s profile on WeWrite`,
        openGraph: {
          title: `${displayName} on WeWrite`,
          description: `${displayName}'s profile on WeWrite`,
          url: `${process.env.NEXT_PUBLIC_BASE_URL}/user/${id}`,
          siteName: 'WeWrite',
          type: 'profile',
        },
        twitter: {
          card: 'summary',
          title: `${displayName} on WeWrite`,
          description: `${displayName}'s profile on WeWrite`,
        }
      };
    }

    // If not found by ID, try to find by username
    const usersRef = ref(rtdb, 'users');
    const usernameQuery = query(usersRef, orderByChild('username'), equalTo(id));
    const usernameSnapshot = await get(usernameQuery);

    if (usernameSnapshot.exists()) {
      const userData = Object.entries(usernameSnapshot.val())[0][1];
      const displayName = userData.displayName || userData.username || 'User';

      const canonicalUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/user/${id}`;
      const profileDescription = userData.bio
        ? `${displayName}'s profile on WeWrite. ${typeof userData.bio === 'string' ? userData.bio.substring(0, 150) : 'Writer and collaborator on WeWrite.'}`
        : `${displayName}'s profile on WeWrite - Writer and collaborator on the social wiki where every page is a fundraiser.`;

      return {
        title: `${displayName} on WeWrite`,
        description: profileDescription,
        keywords: `${displayName}, profile, writer, WeWrite, collaboration, social wiki`,
        authors: [{ name: displayName }],
        creator: displayName,
        publisher: 'WeWrite',
        alternates: {
          canonical: canonicalUrl,
        },
        robots: {
          index: true,
          follow: true,
          googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
          },
        },
        openGraph: {
          title: `${displayName} on WeWrite`,
          description: profileDescription,
          url: canonicalUrl,
          siteName: 'WeWrite',
          type: 'profile',
          images: userData.photoURL ? [
            {
              url: userData.photoURL,
              width: 400,
              height: 400,
              alt: `${displayName}'s profile picture`,
            }
          ] : undefined,
        },
        twitter: {
          card: 'summary',
          title: `${displayName} on WeWrite`,
          description: profileDescription,
          images: userData.photoURL ? [userData.photoURL] : undefined,
        }
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

export default async function UserLayout({ children, params }) {
  // Get the user data for schema markup
  let schemaMarkup = null;

  try {
    const { id } = await params;
    const rtdb = getDatabase(app);

    // First, try to get user by ID directly
    const userByIdRef = ref(rtdb, `users/${id}`);
    const userByIdSnapshot = await get(userByIdRef);

    let userData = null;
    let userId = null;

    if (userByIdSnapshot.exists()) {
      userData = userByIdSnapshot.val();
      userId = id;
    } else {
      // If not found by ID, try to find by username
      const usersRef = ref(rtdb, 'users');
      const usernameQuery = query(usersRef, orderByChild('username'), equalTo(id));
      const usernameSnapshot = await get(usernameQuery);

      if (usernameSnapshot.exists()) {
        const userEntry = Object.entries(usernameSnapshot.val())[0];
        userId = userEntry[0];
        userData = userEntry[1];
      }
    }

    if (userData) {
      const displayName = userData.displayName || userData.username || 'User';
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
        name: displayName,
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
        <Script
          id="schema-markup"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaMarkup) }}
        />
      )}
      {children}
    </>
  );
}
