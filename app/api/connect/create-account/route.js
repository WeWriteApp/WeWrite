import { NextResponse } from "next/server";
import Stripe from "stripe";
import admin from "firebase-admin";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
    databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DB_URL,
  });
}

const db = admin.database();

// Function to validate phone numbers
function formatPhoneNumber(phone) {
  const sanitized = phone.trim();
  if (!/^\+\d{10,15}$/.test(sanitized)) {
    throw new Error("Phone number must be in E.164 format (e.g., +14155552671)");
  }
  return sanitized;
}

export async function POST(req) {
  try {
    const data = await req.json();
    const ip = req.headers.get("x-forwarded-for") || "0.0.0.0"; // Capture IP

    // Validate Required Fields
    const requiredFields = [
      "firstName", "lastName", "email", "dob", "phone",
      "address", "ssn"
    ];

    for (const field of requiredFields) {
      if (!data[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }

    // Validate and Format Phone Number
    let formattedPhone;
    try {
      formattedPhone = formatPhoneNumber(data.phone);
    } catch (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Create Stripe Custom Connected Account (Without Business Profile)
    const account = await stripe.accounts.create({
      type: "custom",
      country: data.address.country,
      email: data.email,
      business_type: "individual",
      individual: {
        first_name: data.firstName,
        last_name: data.lastName,
        email: data.email,
        phone: formattedPhone,
        dob: {
          day: parseInt(data.dob.day),
          month: parseInt(data.dob.month),
          year: parseInt(data.dob.year),
        },
        address: {
          line1: data.address.line1,
          city: data.address.city,
          state: data.address.state,
          postal_code: data.address.postal_code,
          country: data.address.country,
        },
        ssn_last_4: data.ssn,
      },
      business_profile: {
        url: 'https://getwewrite.app/user/' + data.uid, // URL to user profile
        mcc: 5815, // Merchant Category Code (Industry)
      },
      external_account: {
        object: "bank_account",
        country: data.address.country,
        currency: "usd",
        account_number: data.external_account.account_number,
        routing_number: data.external_account.routing_number,
      },
      tos_acceptance: {
        date: Math.floor(Date.now() / 1000),
        ip: ip,
      },
      capabilities: {
        transfers: { requested: true },
        card_payments: { requested: true },
      },
      metadata: {
        user_ip: ip,
      }
    });

    if (data.uid) {
      console.log("Updating user with Stripe Account ID");
      let userRef = db.ref(`users/${data.uid}`);
      await userRef.update({
        stripeAccountId: account.id,
      });
      console.log("User updated successfully");
    }

    return NextResponse.json(
      {
        message: "Stripe Custom account successfully created and validated",
        accountId: account.id,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Error processing onboard request:", error);
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}