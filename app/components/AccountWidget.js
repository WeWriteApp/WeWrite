"use client";
import React, { useEffect, useState, useContext } from "react";
import { PortfolioContext } from "../providers/PortfolioProvider";
import SubscriptionsTable from "./SubscriptionsTable";
import Button from "./button/DefaultButton";
import axios from 'axios'
import { loadStripe } from "@stripe/stripe-js";
import { AuthContext } from "../providers/AuthProvider";
import SelectAmountModal from "./modal/SelectAmount";
import { useDisclosure } from "@nextui-org/react";
import { DataContext } from "../providers/DataProvider";

const AccountWidget = () => {
  const { totalSubscriptionsCost, remainingBalance } =
    useContext(PortfolioContext);
  const { user } = useContext(AuthContext);
  const { loading, setLoading } = useContext(DataContext);
  const [error, setError] = useState(null);

  const { isOpen, onOpen, onOpenChange } = useDisclosure();

  const deposit = async (amount) => {
    setLoading(true);
    setError(null);
    try {
      const payment_id = await axios.post('/api/payments', {
        amount: amount, // Amount in cents (5000 cents = $50)
        currency: 'usd', // Or 'eur', 'gbp', etc.
        userId: user.uid,
        type: "deposit"
      });

      const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
      await stripe.redirectToCheckout({ sessionId: payment_id.data });

      setLoading(false);
    } catch (err) {
      console.error('Error:', err);
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col mt-4 md:mt-8 border p-4 w-full">
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Total funds for the month</h2>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-500">Total Allocated</span>
        <span className="text-gray-800 font-semibold">
          ${totalSubscriptionsCost}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-gray-500">Remaining Budget for the month:</span>
        <span className="text-gray-800 font-semibold">${remainingBalance}</span>
      </div>
      <div className="w-full items-end justify-end flex gap-2">
        <Button className="" onClick={() => onOpen()} disabled={loading}>Deposit</Button>
        <Button>Withdraw</Button>
      </div>
      <SelectAmountModal isOpen={isOpen} onOpen={onOpen} onOpenChange={onOpenChange} action={deposit} />
    </div>
  );
};

export default AccountWidget;
