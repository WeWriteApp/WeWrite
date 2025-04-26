// A static image route that returns a pre-generated PNG
// Add export for dynamic route handling to prevent static build errors
export const dynamic = 'force-dynamic';
export async function GET() {
  // This is a very simple implementation that just returns a static base64-encoded image
  // We're using this as a fallback while troubleshooting the dynamic OG image generation

  // Define a static response
  return new Response(
    'Static OpenGraph image response - WeWrite',
    {
      status: 200,
      headers: {
        'Content-Type': 'text/plain',
      },
    }
  );
}
