import { NextResponse } from 'next/server';
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const stripeCustomerId = searchParams.get('uid');

  if (!stripeCustomerId) {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  try {
    // Fetch all past invoices
    const invoices = await stripe.invoices.list({
      customer: stripeCustomerId,
    });

    // Fetch upcoming invoice (if available)
    let upcomingInvoice = null;
    try {
      upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: stripeCustomerId,
      });
    } catch (error) {
      // If no upcoming invoice exists, it's normal behavior
      if (error.type !== "StripeInvalidRequestError") {
        console.error("Error fetching upcoming invoice:", error);
      }
    }

    return NextResponse.json({
      pastInvoices: invoices.data,
      upcomingInvoice: upcomingInvoice || null,
    });

  } catch (error) {
    console.error("Error fetching invoices:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}