"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { auth, onAuthStateChanged } from "../firebase/auth";

export const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    let unsubscribe;
    try {
      unsubscribe = onAuthStateChanged(auth, (user) => {
        try {
          if (user) {
            setUser({
              uid: user.uid,
              email: user.email,
              displayName: user.displayName,
              username: user.username || user.displayName,
              groups: user.groups || ['default-group']
            });
          } else {
            setUser(null);
          }
          setError(null);
        } catch (err) {
          console.error('Error processing auth state:', err);
          setError(err.message);
        } finally {
          setLoading(false);
        }
      });
    } catch (err) {
      console.error('Error setting up auth listener:', err);
      setError(err.message);
      setLoading(false);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500 text-center">
          <p>Authentication Error</p>
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
};
