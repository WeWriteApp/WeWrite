"use client";
import React, { useState, useEffect, useRef } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { useParams } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { useLedger } from "../providers/LedgerProvider";

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

const PledgeBar = () => {
  const { user, loading } = useAuth();
  const [budget, setBudget] = useState(0); // in cents
  const [usedAmount, setUsedAmount] = useState(0); // in cents
  const [donateAmount, setDonateAmount] = useState(0); // in cents
  const [menuVisible, setMenuVisible] = useState(false);
  const [customVisible, setCustomVisible] = useState(false);
  const [customCheck, setCustomCheck] = useState(false);
  const [interval, setInterval] = useState(100);
  const [inputVisible, setInputVisible] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(true);
  const { ledger, addSubscription, updateSubscription } = useLedger();

  const timerRef = useRef(null);
  const textRef = useRef(null);
  const { id } = useParams();

  useEffect(() => {
    // Ensure ledger is loaded and contains required data
    if (!ledger) return;
  
    const { budget, subscriptions } = ledger;
  
    // Set budget and usedAmount in cents
    setBudget(budget || 0); // Fallback to 0 if undefined
    const used = Object.values(subscriptions || {})
      .filter((sub) => sub.status === "active")
      .reduce((total, sub) => total + sub.amount, 0);
    setUsedAmount(used); // Calculate used budget
  
    // Set donation amount for the current subscription (if exists)
    const subscription = subscriptions[id];
    if (subscription) {
      setDonateAmount(subscription.amount || 0);
    } else {
      setDonateAmount(0); // Default to 0 if no subscription found
    }
  }, [ledger, id]);

  const handleDonationChange = (newAmount) => {
    if (isNaN(newAmount) || newAmount < 0 || newAmount > budget - usedAmount + donateAmount) return;

    setDonateAmount(newAmount);

    if (ledger.subscriptions[id]) {
      // Update existing subscription
      updateSubscription(id, { amount: newAmount });
    } else {
      // Add new subscription
      addSubscription(id, {
        amount: newAmount,
        status: "active",
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


  return (
    <div className="w-11/12 sm:max-w-[300px]">
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
              <span className="text-[24px] font-normal text-white">
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
