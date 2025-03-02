"use client";

import { useState, useEffect } from "react";
import { loadConnectAndInitialize } from "@stripe/connect-js";
import {
    ConnectComponentsProvider,
    ConnectAccountManagement,
    EmbeddedAccountOnboarding
} from "@stripe/react-connect-js";
import { useAuth } from "../../providers/AuthProvider";
import Balances from "./Balances";

export default function ConnectAccountManager() {
    const { user } = useAuth();
    const [accountStatus, setAccountStatus] = useState("loading");
    const [connectInstance, setConnectInstance] = useState(null);

    useEffect(() => {
        if (!user || !user.stripeAccountId) return;

        const fetchAccountStatus = async () => {
            try {
                const res = await fetch("/api/connect-accounts/check-status", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ stripeAccountId: user.stripeAccountId }),
                });
                const data = await res.json();
                setAccountStatus(data.status);

                if (data.status === "needs_onboarding" || data.status === "active") {
                    const fetchClientSecret = async () => {
                        const sessionRes = await fetch(
                            data.status === "needs_onboarding"
                                ? "/api/connect-accounts/create-account-session"
                                : "/api/connect-accounts/manage-session",
                            {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ stripeAccountId: user.stripeAccountId }),
                            }
                        );
                        const sessionData = await sessionRes.json();
                        return sessionData.client_secret;
                    };

                    const instance = await loadConnectAndInitialize({
                        publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
                        fetchClientSecret: fetchClientSecret, // ✅ Ensures proper client secret is used
                        appearance: {
                            variables: {
                                colorPrimary: "#228403",
                            },
                        },
                    });

                    setConnectInstance(instance);
                }
            } catch (error) {
                console.error("Failed to fetch account status", error);
                setAccountStatus("error");
            }
        };

        fetchAccountStatus();
    }, [user]);

    if (accountStatus === "loading") return <p>Checking account status...</p>;
    if (accountStatus === "restricted") return <p>Your account has restrictions. Please check your Stripe dashboard.</p>;
    if (accountStatus === "error") return <p>There was an error retrieving your account information.</p>;

    return connectInstance ? (
        <ConnectComponentsProvider connectInstance={connectInstance}>
            {accountStatus === "needs_onboarding" ? (
                <EmbeddedAccountOnboarding />
            ) : (
                <>
                <ConnectAccountManagement />
                <Balances />
                </>
            )}
        </ConnectComponentsProvider>
    ) : (
        <p>Loading dashboard...</p>
    );
}