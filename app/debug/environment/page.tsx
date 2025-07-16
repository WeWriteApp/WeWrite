"use client";

import { useState, useEffect } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { getUserProfile } from '../../firebase/database/users';
import { DEV_TEST_USERS } from '../../firebase/developmentAuth';

export default function EnvironmentDebugPage() {
  const [environmentInfo, setEnvironmentInfo] = useState(null);
  const [testUserData, setTestUserData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchEnvironmentInfo = async () => {
    try {
      const response = await fetch('/api/debug/environment');
      const data = await response.json();
      setEnvironmentInfo(data);
    } catch (err) {
      console.error('Error fetching environment info:', err);
      setError('Failed to fetch environment info');
    }
  };

  const initializeTestUsers = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dev/init-test-users', {
        method: 'POST'
      });
      const data = await response.json();
      console.log('Test user initialization result:', data);
      
      if (data.success) {
        alert('Test users initialized successfully!');
        await loadTestUserData();
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      console.error('Error initializing test users:', err);
      alert('Failed to initialize test users');
    } finally {
      setLoading(false);
    }
  };

  const loadTestUserData = async () => {
    try {
      setLoading(true);
      const userData = {};
      
      for (const [key, testUser] of Object.entries(DEV_TEST_USERS)) {
        try {
          const profile = await getUserProfile(testUser.uid);
          userData[key] = {
            ...testUser,
            profileFound: !!profile,
            profileData: profile
          };
        } catch (err) {
          console.error(`Error loading ${key}:`, err);
          userData[key] = {
            ...testUser,
            profileFound: false,
            error: err.message
          };
        }
      }
      
      setTestUserData(userData);
    } catch (err) {
      console.error('Error loading test user data:', err);
      setError('Failed to load test user data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnvironmentInfo();
    loadTestUserData();
  }, []);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <h1 className="text-3xl font-bold">Environment Debug Page</h1>
      
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Environment Information */}
      <Card>
        <CardHeader>
          <CardTitle>Environment Information</CardTitle>
        </CardHeader>
        <CardContent>
          {environmentInfo ? (
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(environmentInfo, null, 2)}
            </pre>
          ) : (
            <p>Loading environment info...</p>
          )}
        </CardContent>
      </Card>

      {/* Test User Management */}
      <Card>
        <CardHeader>
          <CardTitle>Test User Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button 
            onClick={initializeTestUsers} 
            disabled={loading}
            className="mr-4"
          >
            {loading ? 'Initializing...' : 'Initialize Test Users'}
          </Button>
          
          <Button 
            onClick={loadTestUserData} 
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Loading...' : 'Reload Test User Data'}
          </Button>
        </CardContent>
      </Card>

      {/* Test User Data */}
      <Card>
        <CardHeader>
          <CardTitle>Test User Data</CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(testUserData).length > 0 ? (
            <div className="space-y-4">
              {Object.entries(testUserData).map(([key, userData]) => (
                <div key={key} className="border rounded p-4">
                  <h3 className="font-semibold text-lg">{userData.displayName} ({key})</h3>
                  <p className="text-sm text-gray-600">UID: {userData.uid}</p>
                  <p className="text-sm text-gray-600">Email: {userData.email}</p>
                  <p className="text-sm text-gray-600">Username: {userData.username}</p>
                  
                  <div className="mt-2">
                    <span className={`inline-block px-2 py-1 rounded text-xs ${
                      userData.profileFound 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {userData.profileFound ? 'Profile Found' : 'Profile Not Found'}
                    </span>
                  </div>
                  
                  {userData.error && (
                    <p className="text-red-600 text-sm mt-2">Error: {userData.error}</p>
                  )}
                  
                  {userData.profileData && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-blue-600">
                        View Profile Data
                      </summary>
                      <pre className="bg-gray-100 p-2 rounded text-xs mt-2 overflow-auto">
                        {JSON.stringify(userData.profileData, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p>Loading test user data...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
