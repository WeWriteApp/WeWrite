"use client";
import { useEffect, useState, useContext } from "react";
import { AuthContext } from "../providers/AuthProvider";

export default function PaymentMethodList() {
    const { user } = useContext(AuthContext);
    const [paymentMethod, setPaymentMethod] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!user?.stripeCustomerId) {
            // setError("No Stripe customer ID found.");
            // setLoading(false);
            return;
        }
        // Fetch the default payment method from backend
        fetch(`/api/payments/get-payment-method?customerId=${user.stripeCustomerId}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.paymentMethod) {
                    setPaymentMethod(data.paymentMethod);
                } else {
                    setError("No default payment method found.");
                }
            })
            .catch((err) => {
                console.error("Error fetching payment method:", err);
                setError("Failed to load payment methods.");
            })
            .finally(() => setLoading(false));
    }, [user?.stripeCustomerId]);

    if (loading) return <p>Loading payment methods...</p>;
    if (error) return <p className="text-red-500">{error}</p>;

    return (
        <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Payment Method</h2>

            {paymentMethod ? (
                <div className="p-4 border rounded-lg bg-gray-100 flex items-center justify-between">
                    <div>
                        <p className="font-medium">{paymentMethod.card.brand.toUpperCase()} **** {paymentMethod.card.last4}</p>
                        <p className="text-gray-600 text-sm">Expires {paymentMethod.card.exp_month}/{paymentMethod.card.exp_year}</p>
                    </div>
                    <button
                        className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600"
                        onClick={() => removePaymentMethod(paymentMethod.id)}
                    >
                        Remove
                    </button>
                </div>
            ) : (
                <p>No default payment method found.</p>
            )}
        </div>
    );
}

// Function to remove the default payment method
async function removePaymentMethod(paymentMethodId) {
    const response = await fetch("/api/payments/remove-payment-method", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethodId }),
    });

    const data = await response.json();
    if (data.success) {
        alert("Payment method removed successfully.");
        window.location.reload();
    } else {
        alert("Failed to remove payment method.");
    }
}