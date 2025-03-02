import { NextResponse } from "next/server";
import Stripe from "stripe";

// In-memory store for demonstration; replace with your DB logic.
const userAccounts = {}; // Maps userId -> accountId

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

export async function POST(req) {
  try {
    const { userId } = await req.json();
    if (!userId) {
      return NextResponse.json({ error: "Missing userId" }, { status: 400 });
    }

    let accountId = userAccounts[userId];

    if (accountId) {
      // Retrieve the account to check its status.
      const account = await stripe.accounts.retrieve(accountId);
      // Assume the account is "active" if details have been submitted.
      if (account && account.details_submitted) {
        // Create a management session for the connected account.
        const accountSession = await stripe.accountSessions.create({
          account: accountId,
          components: {
            account_management: { enabled: true },
          },
        });
        return NextResponse.json({
          client_secret: accountSession.client_secret,
          accountId,
          sessionType: "management",
        });
      } else {
        // Account exists but isn't fully set up; run onboarding.
        const accountSession = await stripe.accountSessions.create({
          account: accountId,
          components: {
            account_onboarding: { enabled: true },
          },
        });
        return NextResponse.json({
          client_secret: accountSession.client_secret,
          accountId,
          sessionType: "onboarding",
        });
      }
    } else {
      // No account exists for this user; create one.
      const account = await stripe.accounts.create({
        type: "express",
        country: "US", // Adjust as needed.
        email: `user+${userId}@example.com`, // Replace with the actual email.
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
      });
      accountId = account.id;
      // Save the account ID for future lookups.
      userAccounts[userId] = accountId;

      // Create an onboarding session for the new account.
      const accountSession = await stripe.accountSessions.create({
        account: accountId,
        components: {
          account_onboarding: { enabled: true },
        },
      });
      return NextResponse.json({
        client_secret: accountSession.client_secret,
        accountId,
        sessionType: "onboarding",
      });
    }
  } catch (error) {
    console.error("Error creating Stripe account session:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}