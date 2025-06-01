'use client';

import { useState } from 'react';

export default function TestAPIPage() {
  const [pageId, setPageId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const testAPI = async () => {
    if (!pageId.trim()) {
      setError('Please enter a page ID');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      console.log('Testing API with page ID:', pageId);
      const response = await fetch(`/api/pages/${pageId}`);
      console.log('API response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('API response data:', data);
        setResult(data);
      } else {
        const errorText = await response.text();
        console.error('API error:', errorText);
        setError(`API Error (${response.status}): ${errorText}`);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setError(`Fetch Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Test Pages API</h1>
      
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Page ID:
        </label>
        <input
          type="text"
          value={pageId}
          onChange={(e) => setPageId(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded"
          placeholder="Enter a page ID to test"
        />
      </div>
      
      <button
        onClick={testAPI}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test API'}
      </button>
      
      {error && (
        <div className="mt-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
          <h3 className="font-bold">Error:</h3>
          <pre className="whitespace-pre-wrap">{error}</pre>
        </div>
      )}
      
      {result && (
        <div className="mt-4 p-4 bg-green-100 border border-green-400 text-green-700 rounded">
          <h3 className="font-bold">Success:</h3>
          <pre className="whitespace-pre-wrap">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
      
      <div className="mt-8 p-4 bg-gray-100 rounded">
        <h3 className="font-bold mb-2">Instructions:</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>Enter a valid page ID from your WeWrite application</li>
          <li>Click "Test API" to fetch page details including author information</li>
          <li>Check the browser console for detailed logging</li>
          <li>The result should include: id, title, userId, username, authorUsername, isPublic, etc.</li>
        </ol>
      </div>
    </div>
  );
}
