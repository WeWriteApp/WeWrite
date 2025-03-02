"use client";
import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { useStripe } from "../providers/StripeProvider";

const SubscriptionSettings = () => {
    const { subscription } = useStripe();
    const [prices, setPrices] = useState([]);
    const [currentPlan, setCurrentPlan] = useState(null);
    const [showConfirmChanges, setShowConfirmChanges] = useState(false);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [showCustomAmountModal, setShowCustomAmountModal] = useState(false);

    useEffect(() => {
        fetch("/api/payments/get-prices", {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        }).then((res) => res.json()).then((data) => {
            setPrices(data);
        }).catch((err) => {
            console.error("Error fetching prices:", err);
        });
    }, [])

    useEffect(() => {
        if (selectedPlan !== currentPlan) {
            setShowConfirmChanges(true);
        } else {
            setShowConfirmChanges(false);
        }
    }, [selectedPlan, currentPlan]);

    const handleSelectPlan = (price_id) => {
        setSelectedPlan(price_id);
        setIsPaused(false); // Ensure active state when selecting a plan
    };

    const handleUpdateSubscription = () => {
        if (subscription.length === 0) {
            console.error("No subscription found");
            return;
        }
        // Call API to update subscription with patch to /api/payments/subscription
        // with the selectedPlan
        fetch(`/api/payments/subscription`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ price_id: selectedPlan, subscription_id: subscription[0].id, item_id: subscription[0].items.data[0].id })
        }).then((res) => {
            if (res.ok) {
                console.log("Subscription updated successfully");
                setCurrentPlan(selectedPlan);
                setShowConfirmChanges(false);
            } else {
                console.error("Failed to update subscription");
            }
        }).catch((err) => {
            console.error("Error updating subscription:", err);
        });
    }



    return (
        <div className="max-w-lg mx-auto bg-background p-6 rounded-lg space-y-6">
            {/* My Subscription Section */}
            <div>
                <h2 className="text-xl font-semibold text-text">My subscription</h2>
                <p className="text-sm text-text">
                    Your subscription is your monthly budget to spend on pages on WeWrite.
                </p>
                <div className="mt-4 space-y-2">
                    {prices.map((amount) => (
                        <button
                            key={amount.id}
                            onClick={() => handleSelectPlan(amount.id)}
                            className={`w-full flex justify-between 
                hover:bg-gray-800
                items-center border rounded-lg p-3 cursor-pointer transition-all ${selectedPlan === amount.id
                                    ? "bg-blue-600 text-white border-blue-500 hover:bg-blue-800"
                                    : "bg-background text-text border-gray-700 hover:bg-gray-800"
                                }`}
                        >
                            ${amount.unit_amount / 100} / mo
                        </button>
                    ))}
                    <button className="w-full flex justify-between items-center border border-gray-700 rounded-lg p-3 bg-background text-text hover:bg-gray-800" onClick={() => setShowCustomAmountModal(true)}>
                        Custom <span className="text-gray-300">$500/mo</span>
                    </button>
                </div>
            </div>

            {/* If plan is changed, confirm changes button  */}
            {showConfirmChanges && (
                <button
                    onClick={() => handleUpdateSubscription()}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all"
                >
                    Confirm Changes
                </button>
            )}

            {/* Pause Subscription Button */}

            {showCustomAmountModal && (
                <CustomAmountModal
                    setShowCustomAmountModal={setShowCustomAmountModal}
                    setSelectedPlan={setSelectedPlan}
                />
            )}
        </div>
    );
};

const CustomAmountModal = ({ setShowCustomAmountModal, setSelectedPlan }) => {
    const [customAmount, setCustomAmount] = useState(500);

    const handleSaveCustomAmount = () => {
        setSelectedPlan(customAmount);
        setShowCustomAmountModal(false);
    };

    return (
        <Modal
            isOpen={true}
            title="Custom Subscription Amount"
            onClose={() => setShowCustomAmountModal(false)}
            onConfirm={handleSaveCustomAmount}
        >
            <div className="flex flex-col space-y-4">
                <label htmlFor="customAmount" className="text-text">
                    Enter your custom subscription amount per month:
                </label>
                <input
                    type="number"
                    id="customAmount"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="w-full border border-gray-700 p-3 rounded-lg bg-background text-text"
                />

                <p className="text-gray-400">
                    This amount will be charged to your card every month.
                </p>

                <button
                    onClick={handleSaveCustomAmount}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition-all"
                >
                    Save Custom Amount
                </button>
            </div>
        </Modal>
    );
}


export default SubscriptionSettings;


