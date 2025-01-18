"use client";
import React, { createContext, useState, useContext } from "react";

const LedgerContext = createContext();

const defaultLedger = {
  budget: 1000, // Default budget in cents ($10)
  used: 0, // No subscriptions used initially
  subscriptions: {}, // Empty subscriptions
};

export const LedgerProvider = ({ children }) => {
  const [ledger, setLedger] = useState(() => {
    const savedLedger = localStorage.getItem("ledger");
    return savedLedger ? JSON.parse(savedLedger) : defaultLedger;
  });

  const saveToLocalStorage = (updatedLedger) => {
    localStorage.setItem("ledger", JSON.stringify(updatedLedger));
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
      }}
    >
      {children}
    </LedgerContext.Provider>
  );
};

export const useLedger = () => {
  return useContext(LedgerContext);
};