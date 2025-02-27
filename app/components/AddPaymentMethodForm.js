"use client";
import { useEffect, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import AddPaymentMethod from "./AddPaymentMethod";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);

export default function BillingPage() {
    const [clientSecret, setClientSecret] = useState(null);
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
        if (showForm) {
            fetchClientSecret();
        } else {
            setClientSecret(null); // Reset clientSecret when hiding the form
        }
    }, [showForm]);

    const fetchClientSecret = async () => {
        try {
            const res = await fetch("/api/payments/create-setup-intent", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
            });
            const data = await res.json();
            if (data.clientSecret) {
                setClientSecret(data.clientSecret);
            }
        } catch (error) {
            console.error("Error fetching clientSecret:", error);
        }
    };

    return (
        <div className="space-y-6">
            <button
                onClick={() => setShowForm((prev) => !prev)}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
                {showForm ? "Cancel" : "Add Payment Method"}
            </button>

            {showForm && clientSecret && (
                <Elements stripe={stripePromise} options={{ clientSecret }}>
                    <AddPaymentMethod onClose={() => setShowForm(false)} />
                </Elements>
            )}
        </div>
    );
}