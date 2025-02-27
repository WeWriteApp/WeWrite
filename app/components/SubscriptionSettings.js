"use client";
import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { Icon } from "@iconify/react";
import { useAuth } from "../providers/AuthProvider";

const SubscriptionSettings = () => {
    const { user } = useAuth();
    
    useEffect(() => {
        if (user == null || user.loading) {
            return;
        }
        console.log("user", user);
        fetch(`/api/payments/subscription?uid=${user.stripeCustomerId}`, {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        }).then((res) => res.json()
        ).catch(() => console.log("Failed to load payment form. Please refresh."));
    }, [user])
    
    // const [isLoading, setIsLoading] = useState(user.loading);
    const [selectedPlan, setSelectedPlan] = useState(20);
    const [isPaused, setIsPaused] = useState(false);
    const [showCustomAmountModal, setShowCustomAmountModal] = useState(false);

    const handleSelectPlan = (amount) => {
        setSelectedPlan(amount);
        setIsPaused(false); // Ensure active state when selecting a plan
    };

    const handlePauseSubscription = () => {
        setIsPaused(true);
    };

    useEffect(() => {
        if (isPaused) {
            console.log("Subscription paused");
        }
    }, [isPaused]);

    return (
        <div className="max-w-lg mx-auto bg-background p-6 rounded-lg space-y-6">
            {/* My Subscription Section */}
            <div>
                <h2 className="text-xl font-semibold text-text">My subscription</h2>
                <p className="text-sm text-text">
                    Your subscription is your monthly budget to spend on pages on WeWrite.
                </p>
                <div className="mt-4 space-y-2">
                    {[10, 20, 50, 100].map((amount) => (
                        <button
                            key={amount}
                            onClick={() => handleSelectPlan(amount)}
                            className={`w-full flex justify-between 
                hover:bg-gray-800
                items-center border rounded-lg p-3 cursor-pointer transition-all ${selectedPlan === amount
                                    ? "bg-blue-600 text-white border-blue-500 hover:bg-blue-800"
                                    : "bg-background text-text border-gray-700 hover:bg-gray-800"
                                }`}
                        >
                            ${amount} / mo
                        </button>
                    ))}
                    <button className="w-full flex justify-between items-center border border-gray-700 rounded-lg p-3 bg-background text-text hover:bg-gray-800" onClick={() => setShowCustomAmountModal(true)}>
                        Custom <span className="text-gray-300">$500/mo</span>
                    </button>
                </div>
            </div>

            {/* Account Preview Section */}
            <div>
                <h2 className="text-xl font-semibold text-text">Account preview</h2>
                <p className="text-sm text-gray-400">
                    To cultivate a "pay-it-forward" culture on WeWrite, your account will look inactive if you don’t have an active subscription.
                </p>

                <div className="mt-6 flex items-center justify-between">
                    {/* Inactive Subscription */}
                    <div className="flex flex-col items-center border border-gray-700 px-4 py-3 rounded-lg bg-background">
                        <span className="flex items-center gap-2">
                            🇺🇸 <span className="text-gray-500">jamie</span>
                        </span>
                    </div>

                    {/* Active Subscription */}
                    <div
                        className={`flex flex-col items-center border px-4 py-3 rounded-lg transition-all ${isPaused
                            ? "border-gray-700 bg-background text-gray-500"
                            : "border-green-600 bg-background text-text"
                            }`}
                    >
                        <span className="flex items-center gap-2">
                            🇺🇸 <span className={isPaused ? "text-gray-500" : "text-blue-400"}>jamie</span>
                        </span>
                        {!isPaused && (
                            <span className="mt-2 bg-green-600 text-white px-3 py-1 rounded-lg text-sm">
                                Current
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Pause Subscription Button */}
            <button
                onClick={handlePauseSubscription}
                className="w-full bg-red-900 text-red-300 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 hover:bg-red-800 transition-all"
            >
                <Icon icon="mdi:pause-circle-outline" className="text-lg" />
                Pause subscription
            </button>

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