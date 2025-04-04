import { getDatabase, ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { app } from '../../firebase/config';

export async function generateMetadata({ params }) {
  try {
    const { username } = params;
    const rtdb = getDatabase(app);
    
    // Query users by username
    const usersRef = ref(rtdb, 'users');
    const usernameQuery = query(usersRef, orderByChild('username'), equalTo(username));
    const snapshot = await get(usernameQuery);
    
    if (snapshot.exists()) {
      // Get the first user with this username
      const userData = Object.entries(snapshot.val())[0][1];
      const displayName = userData.displayName || userData.username || 'User';
      
      return {
        title: `${displayName} on WeWrite`,
        description: `${displayName}'s profile on WeWrite`,
        openGraph: {
          title: `${displayName} on WeWrite`,
          description: `${displayName}'s profile on WeWrite`,
          url: `${process.env.NEXT_PUBLIC_BASE_URL}/u/${username}`,
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

export default function UsernameLayout({ children }) {
  return children;
}
