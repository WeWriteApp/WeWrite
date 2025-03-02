"use client";
import { createContext, useContext, useEffect, useState } from "react";
import useSWR from "swr";
import { useAuth } from "./AuthProvider";

const ConnectContext = createContext();

export function ConnectProvider({ children }) {
  const { user } = useAuth();
  const [accountId, setAccountId] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [noStripeAccount, setNoStripeAccount] = useState(false);

  const fetcher = (url) => fetch(url).then((res) => res.json());

  // Fetch Connect Account Details
  const { data: accountData, error: accountError } = useSWR(
    user ? `/api/connect/account?uid=${user.uid}` : null,
    fetcher
  );

  const { data: verificationData } = useSWR(
    accountId ? `/api/connect/check-status?accountId=${accountId}` : null,
    fetcher
  );

  useEffect(() => {
    if (accountError?.status === 404) {
      setNoStripeAccount(true);
      setLoading(false);
      return;
    }

    if (accountData) {
      setAccountId(accountData.accountId || null);
      setNoStripeAccount(false);
    }

    if (verificationData) {
      console.log("Verification Data:", verificationData);
      setVerificationStatus(verificationData.status || null);
    }
    setLoading(false);
  }, [accountData, verificationData, accountError]);

  const createConnectAccount = async (formData) => {
    setLoading(true);
    try {
      const response = await fetch("/api/connect/create-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      setAccountId(data.accountId);
      setNoStripeAccount(false);
      return data;
    } catch (error) {
      console.error("Error creating account:", error);
      throw new Error("Error creating account");
    } finally {
      setLoading(false);
    }
  };

  const uploadIdentityDocument = async (file, accountId) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("accountId", accountId);
    setLoading(true);
    try {
      const response = await fetch("/api/connect/upload-document", {
        method: "POST",
        body: formData,
      });
      return await response.json();
    } finally {
      setLoading(false);
    }
  };

  return (
    <ConnectContext.Provider
      value={{
        accountId,
        verificationStatus,
        noStripeAccount,
        loading,
        createConnectAccount,
        uploadIdentityDocument,
      }}
    >
      {children}
    </ConnectContext.Provider>
  );
}

export function useConnect() {
  return useContext(ConnectContext);
}
