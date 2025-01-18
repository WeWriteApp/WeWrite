"use client";
import React, { createContext, useState, useContext, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/database"; // Import your Firestore configuration

const LedgerContext = createContext();

const defaultLedger = {
  budget: 1000, // Default budget in cents ($10)
  used: 0, // No subscriptions used initially
  subscriptions: {}, // Empty subscriptions
};

export const LedgerProvider = ({ children }) => {
  const [ledger, setLedger] = useState(defaultLedger);
  const [pageInfo, setPageInfo] = useState({});

  useEffect(() => {
    // Load ledger from localStorage on the client side
    if (typeof window !== "undefined") {
      const savedLedger = localStorage.getItem("ledger");
      if (savedLedger) {
        setLedger(JSON.parse(savedLedger));
      }
    }
  }, []);

  // Function to fetch and cache page info
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

  const saveToLocalStorage = (updatedLedger) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("ledger", JSON.stringify(updatedLedger));
    }
  };

  const calculateUsed = (subscriptions) => {
    return Object.values(subscriptions)
      .filter((sub) => sub.status === "active")
      .reduce((total, sub) => total + sub.amount, 0);
  };

  const addSubscription = (pageId, subscription) => {
    setLedger((prevLedger) => {
      const updatedSubscriptions = {
        ...prevLedger.subscriptions,
        [pageId]: subscription,
      };

      const updatedLedger = {
        ...prevLedger,
        subscriptions: updatedSubscriptions,
        used: calculateUsed(updatedSubscriptions),
      };

      saveToLocalStorage(updatedLedger);
      return updatedLedger;
    });
  };

  const updateSubscription = (pageId, updates) => {
    setLedger((prevLedger) => {
      const existingSubscription = prevLedger.subscriptions[pageId] || {};
      const updatedSubscription = {
        ...existingSubscription,
        ...updates,
      };

      const updatedSubscriptions = {
        ...prevLedger.subscriptions,
        [pageId]: updatedSubscription,
      };

      const updatedLedger = {
        ...prevLedger,
        subscriptions: updatedSubscriptions,
        used: calculateUsed(updatedSubscriptions),
      };

      saveToLocalStorage(updatedLedger);
      return updatedLedger;
    });
  };

  const removeSubscription = (pageId) => {
    setLedger((prevLedger) => {
      const { [pageId]: _, ...remainingSubscriptions } = prevLedger.subscriptions;

      const updatedLedger = {
        ...prevLedger,
        subscriptions: remainingSubscriptions,
        used: calculateUsed(remainingSubscriptions),
      };

      saveToLocalStorage(updatedLedger);
      return updatedLedger;
    });
  };

  return (
    <LedgerContext.Provider
      value={{
        ledger,
        addSubscription,
        updateSubscription,
        removeSubscription,
        getPageInfo,
      }}
    >
      {children}
    </LedgerContext.Provider>
  );
};

export const useLedger = () => {
  return useContext(LedgerContext);
};