"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { getDatabase, ref, onValue, update } from 'firebase/database';
import app from '@/firebase/config';
import { auth } from '@/firebase/auth';
import { AppContext } from './AppProvider';

interface User {
  uid: string;
  email: string;
  username?: string;
  displayName?: string;
}

interface AuthContextType {
  user?: User | null;
  loading?: boolean;
  setUser?: React.Dispatch<React.SetStateAction<User | null>>;
}

export const AuthContext = createContext<AuthContextType>({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const { loading, setLoading } = useContext(AppContext)

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        console.log('User is logged in', user);
        getUserFromRTDB(user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const getUserFromRTDB = (user: any) => {
    const db = getDatabase(app);
    const dbRef = ref(db, `users/${user.uid}`);

    onValue(dbRef, (snapshot) => {
      const data = snapshot.val();

      if (data) {
        if (!data.username && user.displayName) {
          update(ref(db), { [`users/${user.uid}/username`]: user.displayName });
          data.displayName = user.displayName;
        } else if (data.username !== user.displayName) {
          update(ref(db), { [`users/${user.uid}/username`]: user.displayName });
          data.username = user.displayName;
        }
      }

      setUser({
        uid: user.uid,
        email: user.email,
        ...data,
      });
      setLoading(false);
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, setUser }}>
      {children}
    </AuthContext.Provider>
  );
};
