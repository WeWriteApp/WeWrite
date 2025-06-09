"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { auth } from "../firebase/config";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/config";

// Maximum number of accounts that can be stored
const MAX_ACCOUNTS = 5;

// Types
interface AccountData {
  uid: string;
  email: string | null;
  username: string;
  lastUsed?: string;
  [key: string]: any;
}

interface MultiAccountContextType {
  accounts: AccountData[];
  currentAccount: AccountData | null;
  loading: boolean;
  switchAccount: (accountId: string) => Promise<boolean>;
  removeAccount: (accountId: string) => void;
  isAtMaxAccounts: boolean;
  maxAccounts: number;
}

interface MultiAccountProviderProps {
  children: ReactNode;
}

// Create context
export const MultiAccountContext = createContext<MultiAccountContextType | undefined>(undefined);

// Custom hook to use the multi-account context
export const useMultiAccount = (): MultiAccountContextType => {
  const context = useContext(MultiAccountContext);
  if (!context) {
    throw new Error("useMultiAccount must be used within a MultiAccountProvider");
  }
  return context;
};

export const MultiAccountProvider = ({ children }: MultiAccountProviderProps) => {
  // State for storing multiple accounts
  const [accounts, setAccounts] = useState<AccountData[]>([]);
  const [currentAccount, setCurrentAccount] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Get user data from Firestore
          const userDoc = await getDoc(doc(db, "users", user.uid));

          let userData = {
            uid: user.uid,
            email: user.email,
            username: user.displayName || '',
          };

          if (userDoc.exists()) {
            const firestoreData = userDoc.data();
            userData = {
              ...userData,
              username: firestoreData.username || user.displayName || '',
              ...firestoreData
            };
          }

          setCurrentAccount(userData);

          // Update accounts list if this is a new account
          updateAccountsList(userData);
        } catch (error) {
          console.error("Error loading user data in MultiAccountProvider:", error);
          const userData = {
            uid: user.uid,
            email: user.email,
            username: user.displayName || '',
          };
          setCurrentAccount(userData);
          updateAccountsList(userData);
        }
      } else {
        setCurrentAccount(null);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Save accounts to localStorage whenever they change
  useEffect(() => {
    if (accounts.length > 0) {
      localStorage.setItem('wewrite_accounts', JSON.stringify(accounts));
    }
  }, [accounts]);

  // Update the accounts list with a new account
  const updateAccountsList = (userData: AccountData) => {
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
        const newAccount: AccountData = {
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
  const switchAccount = async (accountId: string): Promise<boolean> => {
    // First sign out of the current account
    await signOut(auth);

    // Find the account to switch to
    const accountToSwitch = accounts.find(acc => acc.uid === accountId);
    if (!accountToSwitch || !accountToSwitch.email) {
      throw new Error("Account not found or missing email");
    }

    // We need to prompt for password since we don't store passwords
    const password = prompt(`Enter password for ${accountToSwitch.email}:`);
    if (!password) {
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
    } catch (error) {
      console.error("Error switching account:", error);
      alert("Failed to sign in. Please check your password and try again.");
      return false;
    }
  };

  // Remove an account from the list
  const removeAccount = (accountId: string) => {
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
