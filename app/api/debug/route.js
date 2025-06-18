import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const debugLogPath = path.join(process.cwd(), 'debug.log');

export async function POST(request) {
  try {
    const data = await request.json();
    const logEntry = `[${data.timestamp}] ${data.component} - ${data.action || 'render'}\n${JSON.stringify(data, null, 2)}\n\n`;
    
    // Append to debug log file
    fs.appendFileSync(debugLogPath, logEntry);
    
    // Also log to console for immediate visibility
    console.log('DEBUG:', data.component, data.action || 'render', data);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Debug logging error:', error);
    return NextResponse.json({ error: 'Failed to log debug data' }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (fs.existsSync(debugLogPath)) {
      const content = fs.readFileSync(debugLogPath, 'utf8');
      return NextResponse.json({ logs: content });
    } else {
      return NextResponse.json({ logs: 'No debug logs found' });
    }
  } catch (error) {
    console.error('Error reading debug logs:', error);
    return NextResponse.json({ error: 'Failed to read debug logs' }, { status: 500 });
  }
}
