// app/api/logError/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Logging } from '@google-cloud/logging';

// Type definitions
interface ErrorData {
  message?: string;
  stack?: string;
  timestamp?: string;
  url?: string;
  userAgent?: string;
  isGoogleApiError?: boolean;
}

interface ErrorRequestBody {
  error: ErrorData | string;
  stackAnalysis?: string;
  filename?: string;
  lineno?: number;
  colno?: number;
  scriptTags?: string[];
  stack?: string;
  url?: string;
  type?: string;
  userAgent?: string;
}

// Initialize Google Cloud Logging
let logging: Logging | null = null;

// Skip Google Cloud Logging in development to prevent authentication errors
if (process.env.NODE_ENV === 'development') {
  console.log('Google Cloud Logging disabled in development to prevent authentication errors');
} else {
  try {
    const jsonString = process.env.LOGGING_CLOUD_KEY_JSON?.replace(/[\n\r\t]/g, '');
    if (!jsonString || jsonString === '{}') {
      console.log('No Google Cloud Logging credentials provided, skipping GCP logging');
    } else {
      const credentials = JSON.parse(jsonString);
      if (credentials.project_id && credentials.private_key && credentials.client_email) {
        logging = new Logging({
          projectId: process.env.PROJECT_ID || credentials.project_id,
          credentials});
        console.log('Google Cloud Logging initialized successfully');
      } else {
        console.log('Invalid Google Cloud Logging credentials, skipping GCP logging');
      }
    }
  } catch (error) {
    console.error('Failed to initialize Google Cloud Logging (non-fatal):', error);
    // Don't initialize logging client if credentials are invalid
    logging = null;
  }
}

const log = logging ? logging.log('frontend-errors') : null; // Log name

// Function to log the error to Google Cloud Logging
const logToGCP = async (error: ErrorData | string): Promise<void> => {
  if (!logging || !log) {
    console.log('Google Cloud Logging not available, skipping GCP log');
    return;
  }

  try {
    const metadata = { resource: { type: 'global' } };
    const entry = log.entry(metadata, {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()});
    await log.write(entry);
  } catch (logError) {
    console.error('Error logging to GCP (non-fatal):', logError);
  }
};

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!request) {
    return NextResponse.json({ error: 'Request is required' }, { status: 400 });
  }
  try {
    // Handle malformed JSON gracefully
    let body: ErrorRequestBody;
    try {
      body = await request.json();
    } catch (jsonError: any) {
      console.error('Invalid JSON in errors request:', jsonError.message);
      return NextResponse.json({ success: true, warning: 'Invalid JSON, error logged locally only' }, { status: 200 });
    }

    const { error } = body;

    if (!error) {
      return NextResponse.json({ error: 'Error data is required' }, { status: 400 });
    }

    // LOG ALL ERRORS TO TERMINAL - This is what the user wants!
    console.log('🚨 BROWSER ERROR DETECTED:');
    console.log('📍 Error Message:', typeof error === 'string' ? error : error.message);
    console.log('📍 Stack Analysis:', body.stackAnalysis);
    console.log('📍 Filename:', body.filename);
    console.log('📍 Line/Column:', `${body.lineno}:${body.colno}`);
    console.log('📍 Script Tags:', body.scriptTags);
    console.log('📍 Full Stack:', typeof error === 'object' ? error.stack : body.stack);
    console.log('📍 URL:', body.url);
    console.log('📍 Type:', body.type);
    console.log('📍 User Agent:', body.userAgent);
    console.log('📍 Full Body:', JSON.stringify(body, null, 2));
    console.log('🚨 END ERROR DETAILS');

    // Enhanced logging for Google API errors (additional details)
    const isGoogleApiError = (
      (typeof error === 'string' && (
        error.includes('apiKey') ||
        error.includes('authenticator') ||
        error.includes('google')
      )) ||
      (typeof error === 'object' && (
        error.message?.includes('apiKey') ||
        error.message?.includes('authenticator') ||
        error.message?.includes('google') ||
        error.isGoogleApiError
      ))
    );

    if (isGoogleApiError) {
      console.log('🔍 ADDITIONAL GOOGLE API ERROR ANALYSIS:');
      console.log('📍 This appears to be a Google API related error');
    }

    // Try to log the error to Google Cloud, but don't fail if it doesn't work
    try {
      await logToGCP(error);
    } catch (gcpError) {
      console.error('Error logging to GCP (non-fatal):', gcpError);
      // Continue execution - we don't want to fail the error reporting because of GCP issues
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Error in error logging endpoint:', err);
    // Return success even if GCP logging fails to prevent cascading errors
    return NextResponse.json({ success: true, warning: 'Error logged locally only' }, { status: 200 });
  }
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
}