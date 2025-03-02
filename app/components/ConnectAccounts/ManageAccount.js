"use client";

import { useState, useEffect } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedAccount } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function ManageAccount({ userId }) {
    const [clientSecret, setClientSecret] = useState("");

    useEffect(() => {
        fetch("/api/manage-account-session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId }),
        })
            .then((res) => res.json())
            .then((data) => setClientSecret(data.client_secret))
            .catch((err) => console.error("Failed to fetch session", err));
    }, [userId]);

    return clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret }}>
            <EmbeddedAccount />
        </Elements>
    ) : (
        <p>Loading account settings...</p>
    );
}