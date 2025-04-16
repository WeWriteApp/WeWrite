"use client";

import { useState, useEffect } from 'react';
import { Loader, AlertTriangle } from 'lucide-react';
import UsernameHistory from '../components/UsernameHistory';

export default function TestUsernamePage() {
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState("0awG6NuJfrR4YZfLeWZKBHLuqHF3"); // Default user ID from our tests
  const [apiResponse, setApiResponse] = useState(null);
  const [error, setError] = useState(null);

  const fetchUserData = async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/username?userId=${userId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch user data');
      }

      setApiResponse(data);
    } catch (err) {
      console.error('Error fetching user data:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Username Test Page</h1>

      <div className="mb-6">
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            placeholder="Enter User ID"
            className="flex-1 p-2 border rounded"
          />
          <button
            onClick={fetchUserData}
            disabled={loading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? <><div className="loader"></div> Loading</> : 'Fetch User'}
          </button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 mb-4">
            <div className="flex items-center">
              <AlertTriangle className="h-5 w-5 mr-2" />
              <p>{error}</p>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-xl font-semibold mb-4">API Response</h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : apiResponse ? (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <pre className="whitespace-pre-wrap overflow-auto max-h-96">
                {JSON.stringify(apiResponse, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-gray-500">No data fetched yet</p>
          )}
        </div>

        <div>
          <h2 className="text-xl font-semibold mb-4">UsernameHistory Component</h2>
          <div className="bg-white p-6 rounded-lg border">
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : (
              <UsernameHistory userId={userId} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
