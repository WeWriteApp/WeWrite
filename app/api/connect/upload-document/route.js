import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(req) {
    try {
        const formData = await req.formData();
        const file = formData.get("file");
        const accountId = formData.get("accountId");

        if (!file || !accountId) {
            return new Response(JSON.stringify({ error: "Missing file or accountId" }), { status: 400 });
        }

        // Upload file to Stripe
        const fileUpload = await stripe.files.create({
            purpose: "identity_document",
            file: {
                data: Buffer.from(await file.arrayBuffer()),
                name: file.name,
                type: file.type,
            },
        }, { stripe_account: accountId });

        return new Response(JSON.stringify({ fileId: fileUpload.id }), { status: 200 });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}