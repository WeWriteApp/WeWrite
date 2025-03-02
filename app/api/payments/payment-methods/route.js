import { NextResponse } from 'next/server';
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
});

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const customerId = searchParams.get("uid");

        if (!customerId) {
            return new Response(JSON.stringify({ error: "Missing Stripe Customer ID" }), { status: 400 });
        }

        // Retrieve all payment methods for the customer
        const paymentMethods = await stripe.paymentMethods.list({
            customer: customerId,
            type: "card", // Fetch only card-type payment methods
        });

        let data = paymentMethods.data;

        return NextResponse.json(data);

    } catch (error) {
        console.error("Error fetching payment methods:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}