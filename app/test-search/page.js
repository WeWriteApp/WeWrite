"use client";

import { useState, useEffect } from 'react';

export default function TestSearchPage() {
  const [bigQueryStatus, setBigQueryStatus] = useState({loading: true, data: null, error: null});
  const [searchStatus, setSearchStatus] = useState({loading: true, data: null, error: null});
  const [envStatus, setEnvStatus] = useState({loading: true, data: null, error: null});
  const [hardcodedSearchStatus, setHardcodedSearchStatus] = useState({loading: false, data: null, error: null});
  const [searchTerm, setSearchTerm] = useState("test");
  const [userId, setUserId] = useState("");

  useEffect(() => {
    const fetchBigQueryStatus = async () => {
      try {
        const response = await fetch('/api/test-bigquery');
        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${await response.text()}`);
        }
        const data = await response.json();
        setBigQueryStatus({loading: false, data, error: null});
      } catch (error) {
        console.error("Error fetching BigQuery status:", error);
        setBigQueryStatus({loading: false, data: null, error: error.message});
      }
    };

    const fetchEnvStatus = async () => {
      try {
        const response = await fetch('/api/search-keys');
        if (!response.ok) {
          throw new Error(`API returned ${response.status}: ${await response.text()}`);
        }
        const data = await response.json();
        setEnvStatus({loading: false, data, error: null});
      } catch (error) {
        console.error("Error fetching environment status:", error);
        setEnvStatus({loading: false, data: null, error: error.message});
      }
    };

    fetchBigQueryStatus();
    fetchEnvStatus();
  }, []);

  const testSearch = async () => {
    setSearchStatus({loading: true, data: null, error: null});
    try {
      const response = await fetch(`/api/test-search?q=${encodeURIComponent(searchTerm)}`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${await response.text()}`);
      }
      const data = await response.json();
      setSearchStatus({loading: false, data, error: null});
    } catch (error) {
      console.error("Error testing search:", error);
      setSearchStatus({loading: false, data: null, error: error.message});
    }
  };

  const testHardcodedSearch = async () => {
    setHardcodedSearchStatus({loading: true, data: null, error: null});
    try {
      const queryParams = new URLSearchParams();
      queryParams.append('q', searchTerm);
      if (userId) {
        queryParams.append('userId', userId);
      }
      
      const response = await fetch(`/api/search-file?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error(`API returned ${response.status}: ${await response.text()}`);
      }
      const data = await response.json();
      setHardcodedSearchStatus({loading: false, data, error: null});
    } catch (error) {
      console.error("Error testing hardcoded search:", error);
      setHardcodedSearchStatus({loading: false, data: null, error: error.message});
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Search Diagnostics</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Environment Variables</h2>
        {envStatus.loading ? (
          <p>Loading environment status...</p>
        ) : envStatus.error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p>Error: {envStatus.error}</p>
          </div>
        ) : (
          <div className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96">
            <pre>{JSON.stringify(envStatus.data, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">BigQuery Connection Status</h2>
        {bigQueryStatus.loading ? (
          <p>Loading status...</p>
        ) : bigQueryStatus.error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p>Error: {bigQueryStatus.error}</p>
          </div>
        ) : (
          <div className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96">
            <pre>{JSON.stringify(bigQueryStatus.data, null, 2)}</pre>
          </div>
        )}
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Environment Check</h2>
        <p>GOOGLE_CLOUD_KEY_JSON present: {bigQueryStatus.data?.hasCredentials ? "✅" : "❌"}</p>
        <p>Credentials Valid: {bigQueryStatus.data?.credentialsValid ? "✅" : "❌"}</p>
        <p>BigQuery Initialized: {bigQueryStatus.data?.isInitialized ? "✅" : "❌"}</p>
        <p>Connection Successful: {bigQueryStatus.data?.connectionSuccess ? "✅" : "❌"}</p>
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Test Search Query</h2>
        <div className="flex space-x-2 mb-4">
          <input 
            type="text" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="border p-2 rounded"
            placeholder="Search term"
          />
          <button 
            onClick={testSearch}
            className="bg-blue-500 text-white px-4 py-2 rounded"
          >
            Test Search
          </button>
        </div>
        
        {searchStatus.loading ? (
          <p>Testing search...</p>
        ) : searchStatus.error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p>Error: {searchStatus.error}</p>
          </div>
        ) : searchStatus.data ? (
          <div className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96">
            <pre>{JSON.stringify(searchStatus.data, null, 2)}</pre>
          </div>
        ) : (
          <p>Click "Test Search" to run a test query</p>
        )}
      </div>

      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Alternative Approach: Hardcoded Credentials</h2>
        <p className="mb-2">
          This approach uses credentials hardcoded in the API route file. 
          <span className="text-red-500 font-bold"> You need to edit app/api/search-file/route.js to add your actual credentials.</span>
        </p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          <input 
            type="text" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="border p-2 rounded"
            placeholder="Search term"
          />
          <input 
            type="text" 
            value={userId} 
            onChange={(e) => setUserId(e.target.value)} 
            className="border p-2 rounded"
            placeholder="User ID (optional)"
          />
          <button 
            onClick={testHardcodedSearch}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Test Hardcoded Search
          </button>
        </div>
        
        {hardcodedSearchStatus.loading ? (
          <p>Testing hardcoded search...</p>
        ) : hardcodedSearchStatus.error ? (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            <p>Error: {hardcodedSearchStatus.error}</p>
          </div>
        ) : hardcodedSearchStatus.data ? (
          <div className="bg-gray-100 p-4 rounded-lg overflow-auto max-h-96">
            <pre>{JSON.stringify(hardcodedSearchStatus.data, null, 2)}</pre>
          </div>
        ) : (
          <p>Click "Test Hardcoded Search" to test the hardcoded credentials approach</p>
        )}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-2">Troubleshooting Steps</h2>
        <ol className="list-decimal pl-5 space-y-2">
          <li className="text-yellow-500 font-semibold">
            Try using a different environment variable name:
            <ol className="list-disc pl-5 space-y-1 mt-1 text-white font-normal">
              <li>In Vercel, create a new environment variable named <code>GOOGLE_CLOUD_CREDENTIALS</code></li>
              <li>Copy your Google Cloud key JSON to this new variable</li>
              <li>Redeploy your application</li>
            </ol>
          </li>
          <li>Check that <code>GOOGLE_CLOUD_KEY_JSON</code> environment variable is set in Vercel</li>
          <li>Verify the JSON key format is correct (no line breaks, valid JSON)</li>
          <li>Make sure the service account has access to BigQuery</li>
          <li>Confirm that the BigQuery dataset <code>wewrite-ccd82.pages_indexes.pages</code> exists</li>
          <li className="text-green-500 font-semibold">
            Try Base64 encoding your JSON key:
            <ol className="list-disc pl-5 space-y-1 mt-1">
              <li>Go to a Base64 encoder website (like <a href="https://www.base64encode.org/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">base64encode.org</a>)</li>
              <li>Paste your entire Google Cloud key JSON</li>
              <li>Encode to Base64</li>
              <li>Copy the Base64 string to your <code>GOOGLE_CLOUD_CREDENTIALS</code> variable</li>
              <li>Set a new environment variable <code>GOOGLE_CLOUD_KEY_BASE64</code> to <code>true</code></li>
              <li>Redeploy your application after updating the environment variables</li>
            </ol>
          </li>
        </ol>
      </div>
    </div>
  );
} 