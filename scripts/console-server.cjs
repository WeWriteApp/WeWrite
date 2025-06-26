#!/usr/bin/env node

const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Create log directory if it doesn't exist
const logDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

// Create write streams for logs
const logFile = path.join(logDir, 'console.log');
const errorLogFile = path.join(logDir, 'console-errors.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });
const errorLogStream = fs.createWriteStream(errorLogFile, { flags: 'a' });

// Create HTTP server for WebSocket upgrade
const server = http.createServer();
const wss = new WebSocket.Server({ server });

console.log('🖥️  Console Stream Server Starting...');

// Store connected clients
const clients = new Set();

wss.on('connection', (ws, req) => {
  const clientId = Math.random().toString(36).substr(2, 9);
  clients.add(ws);
  
  console.log(`[${clientId}] Browser connected - Total clients: ${clients.size}`);
  
  ws.on('message', (data) => {
    try {
      const logData = JSON.parse(data);
      
      // Format timestamp
      const timestamp = new Date(logData.timestamp).toLocaleTimeString();
      
      // Color codes for different log levels
      const colors = {
        error: '\x1b[31m',
        warn: '\x1b[33m',
        info: '\x1b[36m',
        debug: '\x1b[90m',
        log: '\x1b[37m'
      };
      
      const reset = '\x1b[0m';
      const color = colors[logData.type] || colors.log;
      
      // Format and output to terminal
      const prefix = `${color}[${timestamp}] ${logData.type.toUpperCase()}:${reset}`;
      console.log(`${prefix} ${logData.message}`);
      
      // Write to log files
      const logEntry = `[${logData.timestamp}] [${logData.type.toUpperCase()}] ${logData.message}\n`;
      logStream.write(logEntry);
      if (logData.type === 'error') {
        errorLogStream.write(logEntry);
      }
      
    } catch (error) {
      console.error('Failed to parse log data:', error);
    }
  });
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`[${clientId}] Browser disconnected - Total clients: ${clients.size}`);
  });
  
  ws.on('error', (error) => {
    console.error(`[${clientId}] WebSocket error:`, error);
    clients.delete(ws);
  });
});

// Start server
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Console Stream Server running on ws://localhost:${PORT}`);
  console.log('📡 Waiting for browser connections...');
  console.log(`📝 Logging to: ${logFile}`);
  console.log(`🚨 Errors logged to: ${errorLogFile}`);
  console.log('');
  console.log('💡 To use: Open WeWrite in browser, console logs will appear here');
  console.log('⏹️  To stop: Press Ctrl+C');
  console.log('');
});

// Graceful shutdown
function shutdown() {
  console.log('\n🛑 Shutting down console stream server...');
  wss.close(() => {
    logStream.end();
    errorLogStream.end();
    server.close(() => {
      console.log('✅ Server stopped');
      process.exit(0);
    });
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
