import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

export async function POST(req) {
  try {
    const { stripeAccountId, components } = await req.json();

    if (!stripeAccountId || !components) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 });
    }

    // ✅ Dynamically generate the Account Session based on the requested components
    const accountSession = await stripe.accountSessions.create({
      account: stripeAccountId,
      components, // <-- Directly pass the frontend-defined components
    });

    return NextResponse.json({
      client_secret: accountSession.client_secret,
    });
  } catch (error) {
    console.error("Error creating Account Session:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}