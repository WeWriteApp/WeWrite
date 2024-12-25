"use client";

import { useEffect, useState, createContext, useContext } from "react";
import { auth, onAuthStateChanged } from "../firebase/auth";
import { ref } from "../firebase/rtdb";
import { FirebaseError, FIREBASE_ERROR_TYPES } from "../utils/firebase-errors";

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

  const createStripeCustomer = async (userData) => {
    console.log('Attempting to create Stripe customer for user:', userData.uid);
    try {
      const response = await fetch('/api/payments/create-customer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: userData.uid,
          email: userData.email,
          name: userData.displayName,
        }),
      });

      console.log('Stripe customer creation response status:', response.status);
      const responseData = await response.json();
      console.log('Stripe customer creation response:', responseData);

      if (!response.ok) {
        throw new Error(`Failed to create Stripe customer: ${responseData.error || 'Unknown error'}`);
      }

      return responseData.customerId;
    } catch (error) {
      console.error('Error creating Stripe customer:', error);
      throw error;
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') {
      setLoading(false);
      return;
    }

    let unsubscribe;
    try {
      console.log('Setting up auth state listener');
      unsubscribe = onAuthStateChanged(auth, async (authUser) => {
        console.log('Auth state changed:', authUser ? 'User logged in' : 'User logged out');
        try {
          if (authUser) {
            console.log('Fetching user data from RTDB for:', authUser.uid);

            // Create and verify user reference
            const userRef = ref(`users/${authUser.uid}`);
            if (!userRef || typeof userRef.get !== 'function') {
              console.error('Invalid database reference:', userRef);
              throw new FirebaseError(
                FIREBASE_ERROR_TYPES.RTDB_INIT_FAILED,
                'Invalid database reference - missing required methods'
              );
            }

            // Get user data
            let userData = {};
            try {
              const userSnapshot = await userRef.get();
              userData = userSnapshot.val() || {};
              console.log('User data from RTDB:', userData);
            } catch (error) {
              console.warn('Error fetching user data, using defaults:', error);
              // In development with mock DB, create default user data
              if (process.env.NODE_ENV === 'development' && process.env.USE_MOCK_DB === 'true') {
                userData = {
                  username: authUser.displayName,
                  groups: ['default-group']
                };
              } else {
                throw error;
              }
            }

            let stripeCustomerId = userData.stripeCustomerId;
            console.log('Existing Stripe customer ID:', stripeCustomerId);

            if (!stripeCustomerId) {
              console.log('No Stripe customer ID found, creating new customer');
              try {
                stripeCustomerId = await createStripeCustomer(authUser);
                console.log('Created new Stripe customer:', stripeCustomerId);
                if (stripeCustomerId) {
                  await userRef.update({ stripeCustomerId });
                  console.log('Updated user with Stripe customer ID');
                }
              } catch (error) {
                console.error('Failed to create/update Stripe customer:', error);
                setError('Failed to set up payment information');
              }
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
          setError(err instanceof FirebaseError ? err.message : 'Failed to access user data');
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
