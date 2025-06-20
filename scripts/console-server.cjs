#!/usr/bin/env node

const WebSocket = require('ws');
const http = require('http');

// Create HTTP server for WebSocket upgrade
const server = http.createServer();
const wss = new WebSocket.Server({ server });

console.log('🖥️  Console Stream Server Starting...');

// Store connected clients
const clients = new Set();

wss.on('connection', (ws, req) => {
  const clientId = Math.random().toString(36).substr(2, 9);
  clients.add(ws);
  
  console.log(`📱 Browser connected [${clientId}] - Total clients: ${clients.size}`);
  
  ws.on('message', (data) => {
    try {
      const logData = JSON.parse(data);
      
      // Format timestamp
      const timestamp = new Date(logData.timestamp).toLocaleTimeString();
      
      // Color codes for different log levels
      const colors = {
        error: '\x1b[31m',   // Red
        warn: '\x1b[33m',    // Yellow
        info: '\x1b[36m',    // Cyan
        debug: '\x1b[90m',   // Gray
        log: '\x1b[37m'      // White
      };
      
      const reset = '\x1b[0m';
      const color = colors[logData.type] || colors.log;
      
      // Format and output to terminal
      const prefix = `${color}[${timestamp}] ${logData.type.toUpperCase()}:${reset}`;
      console.log(`${prefix} ${logData.message}`);
      
    } catch (error) {
      console.error('Failed to parse log data:', error);
    }
  });
  
  ws.on('close', () => {
    clients.delete(ws);
    console.log(`📱 Browser disconnected [${clientId}] - Total clients: ${clients.size}`);
  });
  
  ws.on('error', (error) => {
    console.error(`WebSocket error [${clientId}]:`, error);
    clients.delete(ws);
  });
});

// Start server
const PORT = 3001;
server.listen(PORT, () => {
  console.log(`🚀 Console Stream Server running on ws://localhost:${PORT}`);
  console.log('📡 Waiting for browser connections...');
  console.log('');
  console.log('💡 To use: Open WeWrite in browser, console logs will appear here');
  console.log('⏹️  To stop: Press Ctrl+C');
  console.log('');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down console stream server...');
  wss.close(() => {
    server.close(() => {
      console.log('✅ Server stopped');
      process.exit(0);
    });
  });
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Received SIGTERM, shutting down...');
  wss.close(() => {
    server.close(() => {
      process.exit(0);
    });
  });
});
