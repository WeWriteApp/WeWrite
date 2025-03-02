"use client";
import SubscriptionSettings from "../../components/SubscriptionSettings";
import PaymentMethodList from "../../components/PaymentMethodList";
import BillingOverview from "../../components/CustomerBillingOverview";
import AddPaymentMethodForm from "../../components/AddPaymentMethodForm";
import Tabs from "../../components/Tabs";
export default function SubscriptionPage() {
    const tabs = [
        { label: "Your Subscription" },
        { label: "Payment Methods" },
    ];
    return (
        <>
            <h1 className="text-3xl font-semibold mb-4">Subscription & Billing</h1>
        <Tabs>
        <BillingOverview label="Billing Overview" />
        <SubscriptionSettings label="Your Subscription" />
        <PaymentMethodList label="Payment Methods" />
        </Tabs>
        </>
    );
}