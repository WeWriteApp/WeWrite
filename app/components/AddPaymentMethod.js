"use client";
import { useState, useEffect } from "react";
import { useStripe, useElements, PaymentElement } from "@stripe/react-stripe-js";

export default function AddPaymentMethod() {
    const stripe = useStripe();
    const elements = useElements();
    const [clientSecret, setClientSecret] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");

    // Fetch a SetupIntent from the backend
    useEffect(() => {
        fetch("/api/payments/create-setup-intent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        })
            .then((res) => res.json())
            .then((data) => setClientSecret(data.clientSecret))
            .catch(() => setMessage("Failed to load payment form. Please refresh."));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage("");

        if (!stripe || !elements) return;

        const { error } = await stripe.confirmSetup({
            elements,
            confirmParams: {
                return_url: `${window.location.origin}/settings/billing?success=true`,
            },
        });

        if (error) {
            setMessage(error.message);
        } else {
            setMessage("Payment method added successfully!");
        }

        setLoading(false);
    };

    return (
        <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add a Payment Method</h2>

            {/* Show Error/Success Messages */}
            {message && (
                <div className={`p-3 mb-3 rounded-lg ${message.includes("successfully") ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {message}
                </div>
            )}

            {/* Only show form if we have a client secret */}
            {clientSecret && (
                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Stripe Payment Element */}
                    <PaymentElement options={{ layout: "tabs" }} />

                    {/* Save Payment Button */}
                    <button
                        type="submit"
                        className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-500 transition disabled:bg-gray-300"
                        disabled={loading || !stripe || !clientSecret}
                    >
                        {loading ? "Saving..." : "Save Payment Method"}
                    </button>
                </form>
            )}
        </div>
    );
}