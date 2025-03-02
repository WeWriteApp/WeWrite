import { NextResponse } from "next/server";
import Stripe from "stripe";
import admin from "firebase-admin";

// Initialize Firebase Admin SDK (ensure service account JSON is set up)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL, // Example: "https://your-project-id.firebaseio.com"
  });
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

export async function POST(req) {
  try {
    const db = admin.database();
    const usersRef = db.ref("users"); // Adjust based on your RTDB structure

    // Fetch all users from Firebase RTDB
    const snapshot = await usersRef.once("value");
    const users = snapshot.val();

    if (!users) {
      return NextResponse.json({ error: "No users found in Firebase" }, { status: 404 });
    }

    const updates = {};

    // Loop through all users in RTDB
    for (const [userId, userData] of Object.entries(users)) {
      if (userData.stripeCustomerId) {
        console.log(`User ${userId} already has a Stripe Customer ID, skipping.`);
        continue; // Skip users who already have a Stripe Customer ID
      }

      // Create a Stripe Customer for the user
      const customer = await stripe.customers.create({
        email: userData.email,
        name: userData.name || "No Name Provided",
        metadata: {
          firebaseUID: userId,
        },
      });

      console.log(`Created Stripe Customer: ${customer.id} for User: ${userId}`);

      // Prepare batch update
      updates[`${userId}/stripeCustomerId`] = customer.id;
    }

    // Update Firebase RTDB with Stripe Customer IDs
    if (Object.keys(updates).length > 0) {
      await usersRef.update(updates);
    }

    return NextResponse.json({ message: "Stripe Customer IDs created and linked successfully" }, { status: 201 });
  } catch (error) {
    console.error("Error processing request:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}