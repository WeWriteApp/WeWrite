"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { auth } from "../firebase/config";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";

// Maximum number of accounts that can be stored
const MAX_ACCOUNTS = 5;

// Create context
export const MultiAccountContext = createContext();

// Custom hook to use the multi-account context
export const useMultiAccount = () => {
  const context = useContext(MultiAccountContext);
  if (!context) {
    throw new Error("useMultiAccount must be used within a MultiAccountProvider");
  }
  return context;
};

export const MultiAccountProvider = ({ children }) => {
  // State for storing multiple accounts
  const [accounts, setAccounts] = useState([]);
  const [currentAccount, setCurrentAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load saved accounts from localStorage on mount
  useEffect(() => {
    const loadAccounts = () => {
      try {
        const savedAccounts = localStorage.getItem('wewrite_accounts');
        if (savedAccounts) {
          setAccounts(JSON.parse(savedAccounts));
        }
      } catch (error) {
        console.error("Error loading saved accounts:", error);
        // If there's an error parsing, reset the accounts
        localStorage.removeItem('wewrite_accounts');
        setAccounts([]);
      }
    };

    loadAccounts();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;

      if (user) {
        try {
          // Create basic user data from auth
          let userData = {
            uid: user.uid,
            email: user.email || '',
            username: user.displayName || '',
            lastUsed: new Date().toISOString()
          };

          try {
            // Get additional user data from Firestore
            const userDoc = await getDoc(doc(db, "users", user.uid));

            if (userDoc.exists()) {
              const firestoreData = userDoc.data();
              userData = {
                ...userData,
                username: firestoreData.username || user.displayName || '',
                ...firestoreData
              };
            }
          } catch (firestoreError) {
            // Log error but continue with basic user data
            console.error("Error fetching Firestore data:", firestoreError);
          }

          if (isMounted) {
            setCurrentAccount(userData);
            // Update accounts list if this is a new account
            updateAccountsList(userData);
          }
        } catch (error) {
          console.error("Error in auth state change handler:", error);
          if (isMounted) {
            // Still set basic account info even if there was an error
            const basicUserData = {
              uid: user.uid,
              email: user.email || '',
              username: user.displayName || '',
              lastUsed: new Date().toISOString()
            };
            setCurrentAccount(basicUserData);
            updateAccountsList(basicUserData);
          }
        }
      } else {
        if (isMounted) {
          setCurrentAccount(null);
        }
      }

      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Save accounts to localStorage whenever they change
  useEffect(() => {
    if (accounts.length > 0) {
      localStorage.setItem('wewrite_accounts', JSON.stringify(accounts));
    }
  }, [accounts]);

  // Update the accounts list with a new account
  const updateAccountsList = (userData) => {
    setAccounts(prevAccounts => {
      // Check if this account already exists in the list
      const existingIndex = prevAccounts.findIndex(acc => acc.uid === userData.uid);

      if (existingIndex >= 0) {
        // Update existing account
        const updatedAccounts = [...prevAccounts];
        updatedAccounts[existingIndex] = {
          ...updatedAccounts[existingIndex],
          ...userData,
          lastUsed: new Date().toISOString()
        };
        return updatedAccounts;
      } else {
        // Add new account, respecting the maximum limit
        const newAccount = {
          ...userData,
          lastUsed: new Date().toISOString()
        };

        // If we're at the limit, don't add a new account
        if (prevAccounts.length >= MAX_ACCOUNTS) {
          console.warn(`Maximum account limit (${MAX_ACCOUNTS}) reached. Cannot add more accounts.`);
          return prevAccounts;
        }

        return [...prevAccounts, newAccount];
      }
    });
  };

  // Switch to a different account
  const switchAccount = async (accountId) => {
    // Don't attempt to switch if it's the same account
    if (currentAccount?.uid === accountId) {
      console.log("Already signed in to this account");
      return true;
    }

    try {
      // First sign out of the current account
      await signOut(auth);

      // Find the account to switch to
      const accountToSwitch = accounts.find(acc => acc.uid === accountId);
      if (!accountToSwitch) {
        console.error("Account not found");
        return false;
      }

      if (!accountToSwitch.email) {
        console.error("Account missing email");
        // Remove invalid account from the list
        setAccounts(prevAccounts => prevAccounts.filter(acc => acc.uid !== accountId));
        return false;
      }

      // We need to prompt for password since we don't store passwords
      const password = prompt(`Enter password for ${accountToSwitch.email}:`);
      if (!password) {
        console.log("User cancelled password entry");
        return false; // User cancelled
      }

      try {
        // Sign in with the selected account
        await signInWithEmailAndPassword(auth, accountToSwitch.email, password);

        // Update the last used timestamp
        setAccounts(prevAccounts =>
          prevAccounts.map(acc =>
            acc.uid === accountId
              ? { ...acc, lastUsed: new Date().toISOString() }
              : acc
          )
        );

        return true;
      } catch (signInError) {
        console.error("Error signing in:", signInError);

        // Provide more specific error messages
        if (signInError.code === 'auth/wrong-password') {
          alert("Incorrect password. Please try again.");
        } else if (signInError.code === 'auth/user-not-found') {
          alert("This account no longer exists. It will be removed from your saved accounts.");
          // Remove the account from the list
          setAccounts(prevAccounts => prevAccounts.filter(acc => acc.uid !== accountId));
        } else if (signInError.code === 'auth/too-many-requests') {
          alert("Too many failed login attempts. Please try again later or reset your password.");
        } else {
          alert("Failed to sign in. Please check your password and try again.");
        }

        return false;
      }
    } catch (error) {
      console.error("Error in account switching process:", error);
      alert("An error occurred while switching accounts. Please try again.");
      return false;
    }
  };

  // Remove an account from the list
  const removeAccount = (accountId) => {
    setAccounts(prevAccounts => prevAccounts.filter(acc => acc.uid !== accountId));
  };

  // Check if we've reached the maximum number of accounts
  const isAtMaxAccounts = accounts.length >= MAX_ACCOUNTS;

  // Provide the context value
  const value = {
    accounts,
    currentAccount,
    loading,
    switchAccount,
    removeAccount,
    isAtMaxAccounts,
    maxAccounts: MAX_ACCOUNTS
  };

  return (
    <MultiAccountContext.Provider value={value}>
      {children}
    </MultiAccountContext.Provider>
  );
};
