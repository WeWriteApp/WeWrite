"use client";
import React, { useState, useEffect, useRef } from "react";
import { Icon } from "@iconify/react/dist/iconify.js";
import { useParams } from "next/navigation";

const data = {
  budget: 300,
  used: 50,
  donate: 250,
};

const intervalOptions = [
  { value: 0.01, label: '0.01' },
  { value: 0.1, label: '0.10' },
  { value: 1, label: '1.00' },
  { value: 10, label: '10.00' },
];

const PledgeBar = () => {
  const [budget, setBudget] = useState(data.budget || 0);
  const [usedAmount, setUsedAmount] = useState(data.used || 0);
  const [donateAmount, setDonateAmount] = useState(data.donate || 0);
  const [menuVisible, setMenuVisible] = useState(false);
  const [customVisible, setCustomVisible] = useState(false);
  const [customCheck, setCustomCheck] = useState(false);
  const [interval, setInterval] = useState(1);
  const [inputVisible, setInputVisible] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(true);

  const [isVisible, setIsVisible] = useState(true) // Visibility state


  const timerRef = useRef<any>(null);
  const textRef = useRef<HTMLInputElement | null>(null);
  const scrollTimeoutRef = useRef<any>(null) // Ref for timeout
  const { id }: any = useParams();

  const handleMouseDown = () => {
    timerRef.current = setTimeout(() => setMenuVisible(true), 500);
  };

  const handleMouseUp = () => {
    clearTimeout(timerRef.current);
  };

  const handleAdjustInterval = (newInterval: any) => {
    setInterval(newInterval);
    setMenuVisible(false);
  };


  const handleClickOutside = (event: MouseEvent) => {
    if (textRef.current && !textRef.current.contains(event.target as Node)) {
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

  const progressBarWidth = (value: any, total: any) => (total > 0 ? `${(value / total) * 100}%` : '0%');

  useEffect(() => {
    // Function to handle scroll events
    const handleScroll = () => {
      // Hide the component when scrolling
      setIsVisible(false)

      // Clear the previous timeout if it exists
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }

      // Set a new timeout to show the component after 1 second
      scrollTimeoutRef.current = setTimeout(() => {
        setIsVisible(true)
      }, 1000)
    }

    // Add scroll event listener
    window.addEventListener('scroll', handleScroll)

    // Clean up event listener on component unmount
    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current)
      }
    }
  }, [])

  return (
    <div className={`w-11/12 sm:max-w-[300px] transition-opacity duration-500 ease-in-out ${isVisible ? 'opacity-100' : 'opacity-0'
      }`}>
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
                inputMode="numeric"
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
              <span>{`${interval}`}</span>
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
          style={{ width: progressBarWidth(usedAmount, budget) }}
        >
          <div className="h-full left-[-25px] top-[-25px] flex gap-3 absolute">
            {Array.from({ length: data.used + 30 }, (_, index) => (
              <div key={index} className="w-[6px] h-[calc(100%+50px)] bg-reactangle rotate-45"></div>
            ))}
          </div>
        </div>

        <div
          style={{
            width: progressBarWidth(donateAmount, budget),
            left: progressBarWidth(usedAmount, budget),
          }}
          className={`absolute h-full ${isConfirmed ? 'bg-active-bar active-bar' : 'bg-gray-bar'}`}
        ></div>

        <div className="flex gap-2 justify-between p-2">
          <div
            className="w-action-button h-action-button action-button-gradient p-[8px_8px] flex items-center justify-center cursor-pointer active:scale-95 duration-300 backdrop-blur-sm"
            onClick={() => {
              if (donateAmount - interval >= 0) setDonateAmount(donateAmount - interval);
            }}
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
                value={donateAmount}
                onChange={(e) => {
                  const value = Number(e.target.value);
                  if (value <= budget - usedAmount) setDonateAmount(value);
                }}
                autoComplete="off"
              />
            ) : (
              <span className="text-[24px] font-normal text-white">
                {donateAmount.toFixed(2)}
              </span>
            )}
            /mo
          </div>

          <div
            className="w-action-button h-action-button action-button-gradient p-[8px_8px] flex items-center justify-center cursor-pointer active:scale-95 duration-300 backdrop-blur-sm"
            onClick={() => {
              if (donateAmount + interval <= budget - usedAmount) setDonateAmount(donateAmount + interval);
            }}
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
