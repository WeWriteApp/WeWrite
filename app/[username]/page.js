"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getDatabase, ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { app } from '../firebase/config';
import { Loader } from '../components/Loader';
import SingleProfileView from '../components/SingleProfileView';

export default function UsernamePage({ params }) {
  const { username } = params;
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchUserByUsername() {
      try {
        const rtdb = getDatabase(app);
        
        // Query users by username
        const usersRef = ref(rtdb, 'users');
        const usernameQuery = query(usersRef, orderByChild('username'), equalTo(username));
        const snapshot = await get(usernameQuery);
        
        if (snapshot.exists()) {
          // Get the first user with this username
          const userData = Object.entries(snapshot.val())[0];
          const userId = userData[0];
          const userProfile = userData[1];
          
          setProfile({
            uid: userId,
            ...userProfile
          });
          setIsLoading(false);
        } else {
          // Username not found, check if it's a user ID
          const userRef = ref(rtdb, `users/${username}`);
          const userSnapshot = await get(userRef);
          
          if (userSnapshot.exists()) {
            // It's a user ID, redirect to /u/[id]
            router.replace(`/u/${username}`);
            return;
          }
          
          // Not found
          setError('User not found');
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        setError('Error loading user profile');
        setIsLoading(false);
      }
    }

    fetchUserByUsername();
  }, [username, router]);

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
