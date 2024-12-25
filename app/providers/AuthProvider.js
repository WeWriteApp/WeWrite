"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { auth, onAuthStateChanged } from "../firebase/auth";
import { getDatabase } from "../firebase/database";

export const AuthContext = createContext();
const db = getDatabase();

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

  const createStripeCustomer = async (userData) => {
    try {
      const response = await fetch('/api/payments/create-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userData.uid,
          email: userData.email,
          name: userData.displayName,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create Stripe customer');
      }

      const { customerId } = await response.json();
      return customerId;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      return null;
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    let unsubscribe;
    try {
      unsubscribe = onAuthStateChanged(auth, async (authUser) => {
        try {
          if (authUser) {
            const userSnapshot = await db.ref(`users/${authUser.uid}`).get();
            const userData = userSnapshot.val() || {};

            let stripeCustomerId = userData.stripeCustomerId;
            if (!stripeCustomerId) {
              stripeCustomerId = await createStripeCustomer(authUser);
            }

            setUser({
              uid: authUser.uid,
              email: authUser.email,
              displayName: authUser.displayName,
              username: userData.username || authUser.displayName,
              groups: userData.groups || ['default-group'],
              stripeCustomerId,
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
