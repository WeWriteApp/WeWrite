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
    const body = await request.json();
    const { error } = body;

    if (!error) {
      return NextResponse.json({ error: 'Error data is required' }, { status: 400 });
    }

    // Log the error to Google Cloud
    await logToGCP(error);
    
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (err) {
    console.error('Error logging to GCP:', err);
    return NextResponse.json({ error: 'Failed to log error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Method not allowed' }, { status: 405 });
}
