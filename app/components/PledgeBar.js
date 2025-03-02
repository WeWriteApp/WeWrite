"use client";
import React, { useState, useEffect, useRef } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { useParams } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { useLedger } from "../providers/LedgerProvider";
import AuthModal from "./AuthModal";
import Link from "next/link";

const data = {
  budget: 100,
  used: 0,
  donate: 10,
};

const centsToDollars = (cents) => (cents / 100).toFixed(2);
const dollarsToCents = (dollars) => Math.round(dollars * 100);

const intervalOptions = [
  { value: 1, label: '0.01' },
  { value: 10, label: '0.10' },
  { value: 100, label: '1.00' },
  { value: 1000, label: '10.00' },
];

const PledgeBar = ({
  author
}) => {
  const { user, loading } = useAuth();
  const [showModal, setShowModal] = useState(false);
  // const [budget, setBudget] = useState(0); // in cents
  // const [usedAmount, setUsedAmount] = useState(0); // in cents
  const [donateAmount, setDonateAmount] = useState(0); // in cents
  const [menuVisible, setMenuVisible] = useState(false);
  const [customVisible, setCustomVisible] = useState(false);
  const [customCheck, setCustomCheck] = useState(false);
  const [interval, setInterval] = useState(10);
  const [inputVisible, setInputVisible] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(true);
  const { ledger, addSubscription, updateSubscription, budget, usedAmount } = useLedger();

  const timerRef = useRef(null);
  const textRef = useRef(null);
  const { id } = useParams();

  useEffect(() => {
    if (!ledger) return;
    if (!user) return;
    const subscription = ledger.filter((sub) => sub.pageId === id);
    if (subscription && subscription.length > 0) {
      setDonateAmount(subscription[0].amount || 0);
    } else {
      setDonateAmount(0); // Default to 0 if no subscription found
    }
  }, [ledger, id]);

  const handleDonationChange = async (newAmount) => {
    console.log("New Amount:", newAmount,budget,usedAmount);
    if (newAmount < 0) return; // Prevent negative donations
    setDonateAmount(newAmount); // Update the local state optimistically

    // Find the subscription for the current page
    const subscription = ledger.find((sub) => sub.pageId === id);
    console.log("Subscription:", subscription);
    if (subscription) {
    // Update existing subscription
      await updateSubscription(subscription.id, { amount: newAmount, lastUpdated: new Date().toISOString(), payTo: author });
    } else {
      // Add new subscription
      await addSubscription(user.uid, id,  author,{
        amount: newAmount,
        status: "active",
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        date: new Date().toISOString(),
      });
    }
  };
  const handleMouseDown = () => {
    timerRef.current = setTimeout(() => setMenuVisible(true), 500);
  };

  const handleMouseUp = () => {
    clearTimeout(timerRef.current);
  };

  const handleAdjustInterval = (newInterval) => {
    setInterval(newInterval);
    setMenuVisible(false);
  };

  const handleClickOutside = (event) => {
    if (textRef.current && !textRef.current.contains(event.target)) {
      setInputVisible(false);
    }
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(timerRef.current);
    };
  }, []);

  const progressBarWidth = (value, total) => {
    return total > 0 ? `${(value / total) * 100}%` : "0%";
  };


  if (!user || loading) return (
    <div className="w-11/12 sm:max-w-[300px]">
      <div className="w-full z-10 mb-4 flex flex-col adjust-box rounded-xl text-[17px] p-3 gap-3">
        <button
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-3"
          onClick={() => setShowModal(true)}
        >
          Sign in to pledge
        </button>
        <AuthModal isOpen={showModal} onClose={() => setShowModal(false)} />
      </div>
    </div>
  )

  if (user && user.subscription?.length === 0) return (
    // button to configure your subscription /settings/subscriptions
    <div className="w-11/12 sm:max-w-[300px]">
      <div className="w-full z-10 mb-4 flex flex-col adjust-box rounded-xl text-[17px] p-3 gap-3">
        <Link
          className="w-full bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-3"
          href="/settings/subscription"
        >
          Configure your subscription
        </Link>
      </div>
    </div>
  )
  return (
    <div className="w-12/12 sm:max-w-[300px]">
      {customVisible && (
        <div className="sm:max-w-[300px] w-full z-10 mb-4 flex flex-col adjust-box rounded-xl text-[17px] p-3 gap-3">
          <div className="flex items-center justify-center">
            <Icon
              icon="mdi:close"
              width="24"
              height="24"
              className="absolute left-3 rounded-full border-2 cursor-pointer active:text-blue-500"
              onClick={() => {
                setCustomVisible(false);
                setCustomCheck(true);
              }}
            />
            <h3 className="text-center text-[17px]">Custom pledge interval</h3>
          </div>
          <div className="flex flex-row border-2 border-blue-500 p-4 rounded-xl justify-between">
            <div className="flex flex-row gap-2">
              <span className="font-medium text-gray-46">$</span>
              <input
                type="number"
                inputmode="decimal"
                autoFocus
                className="w-[100px] bg-transparent outline-none"
                value={interval}
                onChange={(e) => setInterval(Number(e.target.value))}
                autoComplete="off"
              />
            </div>
            <span className="font-medium text-gray-46">per month</span>
          </div>
        </div>
      )}

      {menuVisible && (
        <div className="sm:max-w-[300px] w-full z-10 mb-4 flex flex-col divide-y divide-gray-30 adjust-box rounded-xl text-[17px]">
          <h3 className="p-3 text-center">+/- Increment Amount</h3>
          {intervalOptions.map(({ value, label }) => (
            <div
              key={value}
              className="p-3 cursor-pointer flex w-full justify-between active:bg-active-bar"
              onClick={() => handleAdjustInterval(value)}
            >
              <div className="flex flex-row gap-2 text-[17px]">
                <span className="font-medium text-gray-46">$</span>
                <span>{label}</span>
              </div>
              {interval === value && <Icon icon="mdi:check" width="24" height="24" className="text-blue-500" />}
            </div>
          ))}
          <div
            className="p-3 cursor-pointer flex w-full justify-between active:bg-active-bar"
            onClick={() => {
              setCustomVisible(true);
              setMenuVisible(false);
            }}
          >
            <div className="flex flex-row gap-2 text-[17px]">
              <span className="font-medium text-gray-46">$</span>
              <span>{`${interval}.00`}</span>
              <span className="font-medium text-gray-46">custom</span>
            </div>
            {customCheck ? (
              <Icon icon="mdi:check" width="24" height="24" className="text-blue-500" />
            ) : (
              <Icon icon="mdi:keyboard-arrow-right" width="24" height="24" />
            )}
          </div>
        </div>
      )}

      <div className="sm:max-w-[300px] w-full z-10 relative border-gradient overflow-hidden">
        <div
          className="h-full rounded-l-[21px] absolute bg-reactangle overflow-hidden"
          style={{ width: progressBarWidth(usedAmount, budget) }} // Used amount in cents
        >
          <div className="h-full left-[-25px] top-[-25px] flex gap-3 absolute">
            {Array.from({ length: data.used + 30 }, (_, index) => (
              <div key={index} className="w-[6px] h-[calc(100%+50px)] bg-reactangle rotate-45"></div>
            ))}
          </div>
        </div>

        <div
          style={{
            width: progressBarWidth(donateAmount, budget), // Donation in cents
            left: progressBarWidth(usedAmount, budget), // Overlay donation bar on used amount
          }}
          className={`absolute h-full ${isConfirmed ? "bg-active-bar active-bar" : "bg-gray-bar"}`}
        ></div>

        <div className="flex gap-2 justify-between p-2">
          <div
            className="w-action-button h-action-button action-button-gradient p-[8px_8px] flex items-center justify-center cursor-pointer active:scale-95 duration-300 backdrop-blur-sm"
            onClick={() => handleDonationChange(donateAmount - interval)} // Decrement
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUp}
          >
            <Icon icon="mdi:minus" width="24" height="24" />
          </div>

          <div
            className="flex justify-center items-center text-gray gap-1 text-[18px] z-10"
            onDoubleClick={() => setInputVisible(true)}
          >
            $
            {inputVisible ? (
             <input
             type="number"
             ref={textRef}
             className="w-[80px] h-full focus-text text-center text-[24px]"
             value={centsToDollars(donateAmount)} // Convert cents to dollars for display
             onChange={(e) => {
               const value = dollarsToCents(Number(e.target.value)); // Convert input dollars to cents
               if (value <= budget - usedAmount) setDonateAmount(value); // Validate against available budget
             }}
             autoComplete="off"
           />
            ) : (
              <span className="text-[24px] font-normal text-text">
                {centsToDollars(donateAmount)} {/* Convert cents to dollars for display */}
              </span>
            )}
            /mo
          </div>

          <div
            className="w-action-button h-action-button action-button-gradient p-[8px_8px] flex items-center justify-center cursor-pointer active:scale-95 duration-300 backdrop-blur-sm"
            onClick={() => handleDonationChange(donateAmount + interval)} // Increment
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onTouchStart={handleMouseDown}
            onTouchEnd={handleMouseUp}
          >
            <Icon icon="mdi:plus" width="24" height="24" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PledgeBar;
