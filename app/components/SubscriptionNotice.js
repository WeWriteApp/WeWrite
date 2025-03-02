"use client";
import React, { useEffect, useState } from "react";
import Modal from "./Modal";
import { Icon } from "@iconify/react/dist/iconify.js";
import { useStripe } from "../providers/StripeProvider";

const SubscriptionNotice = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { subscription }  = useStripe();

  const handleActivate = () => {
    setIsSubscribed(true);
    setIsOpen(false);
    alert("Subscription Activated!");
  };

  useEffect(() => {
    if (subscription) {
      setIsSubscribed(true);
    }
  }, [subscription]);

  if (isSubscribed) {
    return null;
  }
  return (
    <>
      <button
        className="bg-background text-start border border-gray-700 dark:border-gray-300 p-4 rounded-xl shadow-lg text-text flex flex-col gap-2"
        onClick={() => setIsOpen(true)}
      >
        {/* Inactive Status */}
        <div className="flex items-center gap-2">
          <Icon icon="solar:danger-bold" className="text-yellow-500 text-lg" />
          <h2 className="text-md font-semibold">Inactive</h2>
        </div>

        {/* Subscription Message */}
        <p className="text-sm text-text">
          To start supporting writers, you must activate your subscription.
        </p>

        {/* Activate Button */}
        <div className="bg-blue-600 text-white text-center py-2 rounded-lg font-semibold w-full">
          Activate
        </div>
      </button>
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Activate Your Subscription"
        footer={
          <button
            onClick={handleActivate}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-lg transition"
          >
            Activate
          </button>
        }
      >
        <div className="text-center">
          <div className="text-yellow-500 text-2xl mb-2">⚠</div>
          <p className="text-text text-sm mb-3">
            To start supporting writers, you must activate your subscription.
          </p>
        </div>
      </Modal>
    </>
  );
};

export default SubscriptionNotice;