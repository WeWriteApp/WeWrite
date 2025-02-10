import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
});
export async function POST(req) {
    try {
        const { paymentMethodId } = await req.json();

        if (!paymentMethodId) {
            return new Response(JSON.stringify({ error: "Payment method ID is required" }), { status: 400 });
        }

        await stripe.paymentMethods.detach(paymentMethodId);

        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (error) {
        console.error("Error removing payment method:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}