"use client";
import { useEffect, useState, useContext } from "react";
import { AuthContext } from "../providers/AuthProvider";
import AddPaymentMethodForm from "./AddPaymentMethodForm";
import { useStripe } from "../providers/StripeProvider";

export default function PaymentMethodList() {
    const {paymentMethods} = useStripe();
    return (
        <div className="bg-white border border-gray-300 rounded-lg p-6 shadow-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Your Payment Methods</h2>

            {paymentMethods.length > 0 ? (
                paymentMethods.map((method) => (
                    <div key={method.id} className="p-4 border rounded-lg bg-gray-100 flex items-center justify-between mb-3">
                        <div>
                            <p className="font-medium">{method.card.brand.toUpperCase()} **** {method.card.last4}</p>
                            <p className="text-gray-600 text-sm">Expires {method.card.exp_month}/{method.card.exp_year}</p>
                        </div>
                        <button
                            className="bg-red-500 text-white px-3 py-1 rounded-lg hover:bg-red-600"
                            onClick={() => removePaymentMethod(method.id)}
                        >
                            Remove
                        </button>
                    </div>
                ))
            ) : (
                <p>No payment methods found.</p>
            )}
            <AddPaymentMethodForm />
        </div>
    );
}

// Function to remove a specific payment method
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