"use client";

import { useEffect, useState } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import { app } from '../../firebase/config';
import { Loader } from '../../components/Loader';
import SingleProfileView from '../../components/SingleProfileView';

export default function UserIDPage({ params }) {
  const { id } = params;
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchUserById() {
      try {
        const rtdb = getDatabase(app);
        const userRef = ref(rtdb, `users/${id}`);
        const snapshot = await get(userRef);
        
        if (snapshot.exists()) {
          setProfile({
            uid: id,
            ...snapshot.val()
          });
          setIsLoading(false);
        } else {
          setError('User not found');
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error fetching user:", error);
        setError('Error loading user profile');
        setIsLoading(false);
      }
    }

    fetchUserById();
  }, [id]);

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
