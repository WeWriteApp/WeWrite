import { getDatabase, ref, get } from 'firebase/database';
import { app } from '../../firebase/config';

export async function generateMetadata({ params }) {
  try {
    const { id } = params;
    const rtdb = getDatabase(app);
    const userRef = ref(rtdb, `users/${id}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
      const userData = snapshot.val();
      const displayName = userData.displayName || userData.username || 'User';
      
      return {
        title: `${displayName} on WeWrite`,
        description: `${displayName}'s profile on WeWrite`,
        openGraph: {
          title: `${displayName} on WeWrite`,
          description: `${displayName}'s profile on WeWrite`,
          url: `${process.env.NEXT_PUBLIC_BASE_URL}/u/${id}`,
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

export default function UserIDLayout({ children }) {
  return children;
}
