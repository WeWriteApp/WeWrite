import { NextResponse } from "next/server";
import admin from "firebase-admin";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Initialize Firebase Admin SDK (ensure service account JSON is set up)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL, // Example: "https://your-project-id.firebaseio.com"
  });
}

const db = admin.database();

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("uid");

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const userRef = db.ref(`users/${userId}`);
    const userSnap = await userRef.get();

    if (!userSnap.exists()) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userSnap.val();
    const stripeAccountId = userData?.stripeAccountId;

    if (!stripeAccountId) {
      return NextResponse.json({ error: "Stripe Connect account not found for user" }, { status: 404 });
    }

    // Retrieve the account details from Stripe
    const account = await stripe.accounts.retrieve(stripeAccountId);

    return NextResponse.json({
      accountId: account.id,
      verification_status: account.verification?.status,
      capabilities: account.capabilities,
    });
  } catch (error) {
    console.error("Error retrieving Stripe Connect account:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
