"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Skeleton } from '../components/ui/skeleton';

export default function SearchDebugPage() {
  const [envInfo, setEnvInfo] = useState(null);
  const [bigQueryTest, setBigQueryTest] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('book');
  const [searchResults, setSearchResults] = useState(null);
  const [activeTab, setActiveTab] = useState('environment');

  // Fetch environment info
  const fetchEnvInfo = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/debug-search-env?mode=detailed');
      const data = await response.json();
      setEnvInfo(data.envInfo);
      setBigQueryTest(data.bigQueryTest);
    } catch (error) {
      console.error('Error fetching environment info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Test search functionality
  const testSearch = async () => {
    setIsLoading(true);
    try {
      // Use a fake user ID for testing
      const userId = 'test-user-id';
      const response = await fetch(`/api/search?userId=${userId}&searchTerm=${encodeURIComponent(searchTerm)}`);
      const data = await response.json();
      setSearchResults(data);
    } catch (error) {
      console.error('Error testing search:', error);
      setSearchResults({ error: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  // Load environment info on initial render
  useEffect(() => {
    fetchEnvInfo();
  }, []);

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-6">Search Debug Tool</h1>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="environment">Environment</TabsTrigger>
          <TabsTrigger value="search">Search Test</TabsTrigger>
        </TabsList>
        
        <TabsContent value="environment">
          <Card>
            <CardHeader>
              <CardTitle>Environment Information</CardTitle>
              <CardDescription>Details about your environment configuration</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </div>
              ) : envInfo ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium">Basic Info</h3>
                    <pre className="bg-muted p-4 rounded-md overflow-auto mt-2">
                      {JSON.stringify({
                        nodeEnv: envInfo.nodeEnv,
                        vercelEnv: envInfo.vercelEnv,
                        hasFirebaseConfig: envInfo.hasFirebaseConfig,
                        hasBigQueryCredentials: envInfo.hasBigQueryCredentials,
                        isBase64Encoded: envInfo.isBase64Encoded,
                        timestamp: envInfo.timestamp
                      }, null, 2)}
                    </pre>
                  </div>
                  
                  {envInfo.firebase && (
                    <div>
                      <h3 className="text-lg font-medium">Firebase Configuration</h3>
                      <pre className="bg-muted p-4 rounded-md overflow-auto mt-2">
                        {JSON.stringify(envInfo.firebase, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {envInfo.bigQuery && (
                    <div>
                      <h3 className="text-lg font-medium">BigQuery Configuration</h3>
                      <pre className="bg-muted p-4 rounded-md overflow-auto mt-2">
                        {JSON.stringify(envInfo.bigQuery, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {envInfo.potentialIssues && envInfo.potentialIssues.length > 0 && (
                    <div>
                      <h3 className="text-lg font-medium text-red-500">Potential Issues</h3>
                      <ul className="list-disc pl-5 mt-2">
                        {envInfo.potentialIssues.map((issue, index) => (
                          <li key={index} className="text-red-500">{issue}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  <div>
                    <h3 className="text-lg font-medium">BigQuery Connection Test</h3>
                    {bigQueryTest ? (
                      <div className={`p-4 rounded-md mt-2 ${bigQueryTest.success ? 'bg-green-100 dark:bg-green-900' : 'bg-red-100 dark:bg-red-900'}`}>
                        <p className={`font-medium ${bigQueryTest.success ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'}`}>
                          {bigQueryTest.success ? 'Connection successful!' : 'Connection failed'}
                        </p>
                        {bigQueryTest.error && (
                          <pre className="mt-2 text-sm overflow-auto">
                            {JSON.stringify(bigQueryTest.error, null, 2)}
                          </pre>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground mt-2">No BigQuery test results available</p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-muted-foreground">Failed to load environment information</p>
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={fetchEnvInfo} disabled={isLoading}>
                {isLoading ? 'Loading...' : 'Refresh Environment Info'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
        
        <TabsContent value="search">
          <Card>
            <CardHeader>
              <CardTitle>Search Test</CardTitle>
              <CardDescription>Test the search functionality</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Enter search term"
                    className="flex-1"
                  />
                  <Button onClick={testSearch} disabled={isLoading}>
                    {isLoading ? 'Searching...' : 'Search'}
                  </Button>
                </div>
                
                {searchResults && (
                  <div className="mt-4">
                    <h3 className="text-lg font-medium mb-2">Search Results</h3>
                    <pre className="bg-muted p-4 rounded-md overflow-auto">
                      {JSON.stringify(searchResults, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
