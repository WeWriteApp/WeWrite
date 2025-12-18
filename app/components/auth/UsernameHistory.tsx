"use client";
import React, { useState, useEffect } from "react";
import { Loader, Clock, User, AlertTriangle, Info } from "lucide-react";

interface UsernameHistoryProps {
  userId: string;
}

interface DebugInfo {
  steps: string[];
}

export default function UsernameHistory({ userId }: UsernameHistoryProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUsername, setCurrentUsername] = useState("");
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({ steps: [] });

  useEffect(() => {
    const fetchUsernameData = async () => {
      if (!userId) {
        setLoading(false);
        setError("No user ID provided");
        return;
      }

      try {
        setLoading(true);
        const steps: string[] = [];
        steps.push(`Fetching data for user ID: ${userId}`);

        const apiUrl = `/api/username?userId=${userId}`;
        steps.push(`Calling API endpoint: ${apiUrl}`);

        const response = await fetch(apiUrl);
        steps.push(`API response status: ${response.status}`);

        const data = await response.json();
        steps.push(`API response received: ${JSON.stringify(data).substring(0, 100)}...`);

        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch username data');
        }

        setCurrentUsername(data.username);
        steps.push(`Username set to: ${data.username}`);

        setDebugInfo({ steps });
      } catch (err) {
        const error = err as Error;
        console.error("Error in UsernameHistory:", error);
        setError(`Error: ${error.message}`);
        setDebugInfo(prev => ({
          steps: [...prev.steps, `Fatal error: ${error.message}`]
        }));
      } finally {
        setLoading(false);
      }
    };

    fetchUsernameData();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8 border border-red-200 rounded-lg bg-red-50 p-4">
        <div className="flex items-center justify-center mb-2">
          <AlertTriangle className="h-6 w-6 text-red-500 mr-2" />
          <h3 className="font-medium text-red-700">{error}</h3>
        </div>
        <details className="mt-4 text-left">
          <summary className="cursor-pointer text-sm font-medium text-red-700 flex items-center">
            <Info className="h-4 w-4 mr-1" /> Debug Information
          </summary>
          <div className="mt-2 text-xs text-left bg-white p-3 rounded border border-red-200 overflow-auto max-h-60">
            <ul className="list-disc pl-5 space-y-1">
              {debugInfo.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <User className="h-5 w-5 text-primary" />
        <h3 className="font-medium">Current Username: <span className="text-primary">{currentUsername}</span></h3>
      </div>
      <details className="mt-4 text-left">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground flex items-center">
          <Info className="h-4 w-4 mr-1" /> Debug Information
        </summary>
        <div className="mt-2 text-xs text-left bg-background p-3 rounded border border-border overflow-auto max-h-60">
          <ul className="list-disc pl-5 space-y-1">
            {debugInfo.steps.map((step, index) => (
              <li key={index}>{step}</li>
            ))}
          </ul>
        </div>
      </details>
    </div>
  );
}
