import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
});

export async function POST(req) {
    try {
        const { stripeAccountId } = await req.json();
        if (!stripeAccountId) {
            return NextResponse.json({ error: "Missing stripeAccountId" }, { status: 400 });
        }

        // Create a management session for the connected account
        const accountSession = await stripe.accountSessions.create({
            account: stripeAccountId,
            components: {
                account_management: {
                    enabled: true,
                },
            },
        });

        return NextResponse.json({
            client_secret: accountSession.client_secret,
        });
    } catch (error) {
        console.error("Error creating account management session:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}