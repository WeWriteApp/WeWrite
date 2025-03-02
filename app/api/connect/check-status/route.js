import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
});

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const stripeAccountId = searchParams.get("accountId");
        
        if (!stripeAccountId) {
            return NextResponse.json({ error: "Missing stripeAccountId" }, { status: 400 });
        }

        const account = await stripe.accounts.retrieve(stripeAccountId);

        let status = "unknown";
        if (account.details_submitted) {
            status = "active";
        } else if (account.requirements?.currently_due.length > 0) {
            status = "needs_onboarding";
        } else if (account.charges_enabled === false) {
            status = "restricted";
        }

        return NextResponse.json({ status });
    } catch (error) {
        console.error("Error retrieving account status:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}