"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDatabase, ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { app } from '../../firebase/config';
import { Loader } from '../../components/Loader';
import SingleProfileView from '../../components/SingleProfileView';

export default function UserPage({ params }) {
  const { slug } = params;
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchUser() {
      try {
        const rtdb = getDatabase(app);
        
        // First, try to get user by ID directly (for numeric IDs or known Firebase UIDs)
        const userByIdRef = ref(rtdb, `users/${slug}`);
        const userByIdSnapshot = await get(userByIdRef);
        
        if (userByIdSnapshot.exists()) {
          // Found user by ID
          setProfile({
            uid: slug,
            ...userByIdSnapshot.val()
          });
          setIsLoading(false);
          return;
        }
        
        // If not found by ID, try to find by username
        const usersRef = ref(rtdb, 'users');
        const usernameQuery = query(usersRef, orderByChild('username'), equalTo(slug));
        const usernameSnapshot = await get(usernameQuery);
        
        if (usernameSnapshot.exists()) {
          // Found user by username
          const userData = Object.entries(usernameSnapshot.val())[0];
          const userId = userData[0];
          const userProfile = userData[1];
          
          setProfile({
            uid: userId,
            ...userProfile
          });
          setIsLoading(false);
          return;
        }
        
        // User not found by either ID or username
        setError('User not found');
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching user:", error);
        setError('Error loading user profile');
        setIsLoading(false);
      }
    }

    fetchUser();
  }, [slug, router]);

  if (isLoading) {
    return <Loader />;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h1 className="text-2xl font-bold mb-4">User Not Found</h1>
        <p className="text-muted-foreground">The user you're looking for doesn't exist.</p>
      </div>
    );
  }

  return <SingleProfileView profile={profile} />;
}
