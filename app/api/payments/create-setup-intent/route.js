import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: "2023-10-16",
});

export async function POST(req) {
    try {
        // Ensure the request body is parsed safely
        let body = {};
        try {
            body = await req.json();
        } catch (err) {
            console.warn("No JSON body found, proceeding without parsing.");
        }

        const setupIntent = await stripe.setupIntents.create({
            payment_method_types: ["card", "link"],
        });

        return Response.json({ clientSecret: setupIntent.client_secret });
    } catch (error) {
        console.error("Error creating SetupIntent:", error);
        return Response.json({ error: error.message }, { status: 500 });
    }
}