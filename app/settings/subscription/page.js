"use client";
import SubscriptionSettings from "../../components/SubscriptionSettings";
import PaymentMethodList from "../../components/PaymentMethodList";
import AddPaymentMethodForm from "../../components/AddPaymentMethodForm";

export default function SubscriptionPage() {
    return (
        <>
            <AddPaymentMethodForm />
            <PaymentMethodList />
        <SubscriptionSettings />
        </>
    )
}