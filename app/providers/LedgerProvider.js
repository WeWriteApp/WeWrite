"use client";
import React, { createContext, useState, useContext, useEffect } from "react";
import { doc, getDoc, setDoc, addDoc, updateDoc, where, query, collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/database"; // Import your Firestore configuration
import { useAuth } from "./AuthProvider";
const LedgerContext = createContext();

export const LedgerProvider = ({ children, userId }) => {
  const {user } = useAuth();
  const [ledger, setLedger] = useState([]);
  const [budget, setBudget] = useState(0);
  const [usedAmount, setUsedAmount] = useState(0);
  const [donateAmount, setDonateAmount] = useState(0);
  const [pageInfo, setPageInfo] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
  
    const unsubscribe = onSnapshot(
      query(collection(db, "ledger"), where("userId", "==", user.uid)),
      (querySnapshot) => {
        const ledgerData = querySnapshot.docs.map((doc) => ({
          id: doc.id, // Document ID for updates or deletions
          ...doc.data(), // Subscription data
        }));
        // check if the ledger is empty
        if (ledgerData.length === 0) {
          setLoading(false);
        } else {
          setLedger(ledgerData);
        }
      },
      (error) => {
        console.error("Error listening to ledger updates:", error);
        setLoading(false);
      }
    );
  
    // Cleanup listener on unmount or userId change
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    // on ledger change, calculate budget, usedAmount, and donation amount
    if (!ledger.length) return;

    // Budget is stored on the user object
    setBudget(user.budget || 1000);

    // Calculate `usedAmount` excluding the current page
    const used = ledger
      .filter((sub) => sub.status === "active")
      .reduce((total, sub) => total + sub.amount, 0);

    setUsedAmount(used);

  }, [ledger]);

  const addSubscription = async (userId, pageId, subscription) => {
    try {
      await addDoc(collection(db, "ledger"), {
        userId,
        pageId,
        ...subscription, // e.g., { status: "active", amount: 500, subscriptionDate: new Date().toISOString() }
      });
    } catch (error) {
      console.error("Error adding subscription:", error);
    }
  };
  const updateSubscription = async (subscriptionId, updates) => {
    try {
      const subscriptionRef = doc(db, "ledger", subscriptionId);
      console.log("Updating subscription:", subscriptionId, updates);
      await updateDoc(subscriptionRef, updates);
    } catch (error) {
      console.error("Error updating subscription:", error);
    }
  };

  const removeSubscription = async (subscriptionId) => {
    try {
      const subscriptionRef = doc(db, "ledger", subscriptionId);
      await deleteDoc(subscriptionRef);
    } catch (error) {
      console.error("Error deleting subscription:", error);
    }
  };

  const getPageInfo = async (pageId) => {
    if (pageInfo[pageId]) {
      console.log(`Page info (cached) for ${pageId}:`, pageInfo[pageId]);
      return pageInfo[pageId];
    }
    try {
      const pageDoc = await getDoc(doc(db, "pages", pageId));
      if (pageDoc.exists()) {
        const page = { id: pageDoc.id, ...pageDoc.data() };
        console.log(`Page info for ${pageId}:`, page);
        setPageInfo((prev) => ({ ...prev, [pageId]: page })); // Cache the page info
        return page;
      } else {
        console.warn(`Page with ID ${pageId} does not exist in Firestore.`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching page info for ${pageId}:`, error);
      return null;
    }
  };

  return (
    <LedgerContext.Provider
      value={{
        ledger,
        addSubscription,
        updateSubscription,
        removeSubscription,
        getPageInfo,
        budget,
        usedAmount,
      }}
    >
      {children}
    </LedgerContext.Provider>
  );
};

export const useLedger = () => {
  return useContext(LedgerContext);
};