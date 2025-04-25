"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Loader2 } from "lucide-react";

export default function DebugSearchPage() {
  const [envInfo, setEnvInfo] = useState(null);
  const [testResults, setTestResults] = useState(null);
  const [searchTerm, setSearchTerm] = useState("test");
  const [isLoading, setIsLoading] = useState(false);
  const [isTestingSearch, setIsTestingSearch] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Fetch environment info on page load
    fetchEnvInfo();
  }, []);

  const fetchEnvInfo = async (detailed = true) => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/debug-search?mode=${detailed ? 'detailed' : 'basic'}`);
      const data = await response.json();
      setEnvInfo(data);
    } catch (error) {
      console.error("Error fetching environment info:", error);
      setEnvInfo({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const testSearch = async () => {
    setIsTestingSearch(true);
    try {
      // Test the search API
      const response = await fetch(`/api/search?userId=debug&searchTerm=${encodeURIComponent(searchTerm)}&useScoring=true`);
      const data = await response.json();
      setTestResults({
        status: response.status,
        statusText: response.statusText,
        data
      });
    } catch (error) {
      console.error("Error testing search:", error);
      setTestResults({
        error: error.message
      });
    } finally {
      setIsTestingSearch(false);
    }
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold mb-6">Search Debugging</h1>
      
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Button 
            onClick={() => fetchEnvInfo(true)} 
            disabled={isLoading}
            variant="outline"
          >
            {isLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Refresh Environment Info
          </Button>
          
          <Button 
            onClick={() => router.push('/')}
            variant="ghost"
          >
            Back to Home
          </Button>
        </div>
        
        <div className="bg-card p-4 rounded-md border border-border">
          <h2 className="text-lg font-semibold mb-2">Environment Information</h2>
          {envInfo ? (
            <pre className="text-xs overflow-auto p-2 bg-muted rounded-md max-h-60">
              {JSON.stringify(envInfo, null, 2)}
            </pre>
          ) : (
            <p>Loading environment information...</p>
          )}
        </div>
      </div>
      
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Test Search API</h2>
        <div className="flex items-center gap-2 mb-4">
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search term"
            className="max-w-xs"
          />
          <Button 
            onClick={testSearch} 
            disabled={isTestingSearch}
          >
            {isTestingSearch ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Test Search
          </Button>
        </div>
        
        {testResults && (
          <div className="bg-card p-4 rounded-md border border-border">
            <h3 className="text-md font-semibold mb-2">Search Results</h3>
            <div className="mb-2">
              <span className="font-medium">Status:</span> {testResults.status} {testResults.statusText}
            </div>
            <pre className="text-xs overflow-auto p-2 bg-muted rounded-md max-h-60">
              {JSON.stringify(testResults.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
      
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Troubleshooting Steps</h2>
        <div className="space-y-2">
          <p className="text-sm">If search is not working in the Vercel preview, check the following:</p>
          <ol className="list-decimal list-inside space-y-2 text-sm ml-4">
            <li>Verify that all required environment variables are set in the Vercel project settings</li>
            <li>Check if BigQuery credentials are properly formatted (JSON or Base64)</li>
            <li>Ensure the Firebase configuration is correct</li>
            <li>Look for any errors in the Vercel logs</li>
            <li>Test the search API directly using the tool above</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
