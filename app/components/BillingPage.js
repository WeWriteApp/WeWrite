"use client";
import React, { useEffect, useState, useContext } from "react";
import AccountWidget from "./AccountWidget";
import ChargesTable from "./ChargesTable";
import FundingSources from "./FundingSources";
import FundingTransactionsTable from "./FundingTransactionsTable";
import SubscriptionsTable from "./SubscriptionsTable";
import Link from "next/link";
import Tabs from "./Tabs";

export default function SettingsPage() {
  const [tabs, setTabs] = useState([
    {
      label: "Subscriptions",
      content: <SubscriptionsTable />,
    },
    {
      label: "Charges",
      content: <ChargesTable />,
    },
    {
      label: "Payment Method",
      content: <FundingSources />,
    },
    {
      label: "Funding Transactions",
      content: <FundingTransactionsTable />,
    },
  ]);
  return (
    <>
      <Breadcrumb />
      <h1 className="text-3xl font-semibold mt-4 md:mt-10">Billing & Subscription</h1>
      <AccountWidget />
      <Tabs>
        {tabs.map((tab, index) => (
          <div key={index} label={tab.label}>
            {tab.content}
          </div>
        ))}
      </Tabs>
    </>
  )
}

const Breadcrumb = () => {
  return (
    <div className="flex items-center">
      <Link href="/settings" className="text-gray-500">
        Settings
      </Link>
      <span className="mx-2">/</span>
      <span className="font-semibold">Billing</span>
    </div>
  );
}