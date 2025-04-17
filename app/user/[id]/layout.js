import { getDatabase, ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { app } from '../../firebase/config';

export async function generateMetadata({ params }) {
  try {
    const { id } = params;
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
  } catch (error) {
    console.error('Error generating metadata:', error);
  }

  return {
    title: 'User Profile - WeWrite',
    description: 'User profile on WeWrite',
  };
}

export default function UserLayout({ children }) {
  return children;
}
