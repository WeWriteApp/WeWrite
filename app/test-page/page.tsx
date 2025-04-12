export default function TestPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Test Page</h1>
      <p className="mb-4">This is a test page with OpenGraph metadata.</p>
      
      <div className="mt-8 p-4 bg-gray-100 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">About This Page</h2>
        <p>This page has static OpenGraph metadata with a description and image.</p>
      </div>
    </div>
  );
}
