export default function TestOGPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">OpenGraph Image Test</h1>
      <p className="mb-4">This page is used to test OpenGraph image generation.</p>
      
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Test Links</h2>
        <ul className="list-disc pl-5 space-y-2">
          <li>
            <a 
              href="/api/og/test" 
              target="_blank" 
              className="text-blue-500 hover:underline"
            >
              Test OpenGraph Image
            </a>
          </li>
          <li>
            <a 
              href="/api/og/static" 
              target="_blank" 
              className="text-blue-500 hover:underline"
            >
              Static OpenGraph Image
            </a>
          </li>
        </ul>
      </div>
      
      <div className="mt-8 p-4 bg-gray-100 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Meta Tags</h2>
        <p>This page has the following meta tags:</p>
        <pre className="bg-gray-200 p-2 mt-2 rounded overflow-x-auto">
{`<meta property="og:title" content="OpenGraph Test Page" />
<meta property="og:description" content="This is a test page for OpenGraph images" />
<meta property="og:image" content="https://wewrite.vercel.app/api/og/static" />
<meta property="og:url" content="https://wewrite.vercel.app/test-og" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="OpenGraph Test Page" />
<meta name="twitter:description" content="This is a test page for OpenGraph images" />
<meta name="twitter:image" content="https://wewrite.vercel.app/api/og/static" />`}
        </pre>
      </div>
    </div>
  );
}
