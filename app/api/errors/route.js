// app/api/logError/route.js
import { NextResponse } from 'next/server';
import { Logging } from '@google-cloud/logging';

// Initialize Google Cloud Logging
let logging;
try {
  const jsonString = process.env.LOGGING_CLOUD_KEY_JSON?.replace(/[\n\r\t]/g, '') || '{}';
  const credentials = JSON.parse(jsonString);
  logging = new Logging({
    projectId: process.env.PROJECT_ID,
    credentials,
  });
} catch (error) {
  console.error('Failed to initialize logging:', error);
  logging = new Logging(); // Fallback to default credentials
}

const log = logging.log('frontend-errors'); // Log name

// Function to log the error to Google Cloud Logging
const logToGCP = async (error) => {
  const metadata = { resource: { type: 'global' } };
  const entry = log.entry(metadata, {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString(),
  });
  await log.write(entry);
};

export async function POST(request) {

  if (!request) {
    return NextResponse.json({ error: 'Request is required' }, { status: 400 });
  }
  try {
    // Handle malformed JSON gracefully
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('Invalid JSON in errors request:', jsonError.message);
      return NextResponse.json({ success: true, warning: 'Invalid JSON, error logged locally only' }, { status: 200 });
    }

    const { error } = body;

    if (!error) {
      return NextResponse.json({ error: 'Error data is required' }, { status: 400 });
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

export async function GET() {
  return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
}
