"use client";
import { useEffect, useState, useContext } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { AuthContext } from "../../providers/AuthProvider";
import AddPaymentMethod from "../../components/AddPaymentMethod";
import PaymentMethodList from "../../components/PaymentMethodList";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function BillingPage() {
    const [clientSecret, setClientSecret] = useState("");

    useEffect(() => {
        fetch("/api/payments/create-setup-intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        })
            .then((res) => res.json())
            .then((data) => {
                if (data.clientSecret) {
                    setClientSecret(data.clientSecret);
                }
            })
            .catch((err) => console.error("Error fetching clientSecret:", err));
    }, []);

    return (
        <div className="space-y-6">
            <PaymentMethodList />
            {clientSecret ? (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <AddPaymentMethod />
                </Elements>
            ) : (
                <p>Loading payment form...</p>
            )}
        </div>
    );
}