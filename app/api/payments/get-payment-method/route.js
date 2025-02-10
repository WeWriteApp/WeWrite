import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
});

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const customerId = searchParams.get("customerId");

        if (!customerId) {
            return new Response(JSON.stringify({ error: "Missing Stripe Customer ID" }), { status: 400 });
        }

        // Retrieve the default payment method for the customer
        const customer = await stripe.customers.retrieve(customerId, {
            expand: ["invoice_settings.default_payment_method"],
        });

        if (!customer.invoice_settings.default_payment_method) {
            return new Response(JSON.stringify({ error: "No default payment method found" }), { status: 404 });
        }

        const paymentMethod = customer.invoice_settings.default_payment_method;
        return new Response(JSON.stringify({ paymentMethod }), { headers: { "Content-Type": "application/json" } });
    } catch (error) {
        console.error("Error fetching payment method:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}