# Console Monitoring for AI Debugging

This project includes an automated console monitoring system that streams browser console logs directly to your terminal, making it easy for AI assistants to read and debug issues.

## How It Works

When you run `npm run dev`, two services start automatically:

1. **Next.js Dev Server** (port 3000) - Your main WeWrite application
2. **Console Stream Server** (port 3001) - WebSocket server that receives browser console logs

The browser automatically connects to the console server and streams all console output to your terminal in real-time.

## Usage

### Start Development with Console Monitoring

```bash
npm run dev
```

This automatically starts both the dev server and console listener.

### Alternative Commands

```bash
# Start only the Next.js dev server (no console monitoring)
npm run dev:only

# Start only the console listener
npm run console:listen

# Start both manually (same as npm run dev)
npm run dev:with-console
```

## For AI Assistants

When you need to see console output for debugging:

1. **The console logs are automatically streamed to the terminal**
2. **Use the `read-terminal` tool to see the console output**
3. **Look for color-coded logs:**
   - 🔴 **Red**: Errors
   - 🟡 **Yellow**: Warnings  
   - 🔵 **Cyan**: Info/Log messages
   - ⚪ **Gray**: Debug messages

### Example Terminal Output

```
[CONSOLE] 🚀 Console Stream Server running on ws://localhost:3001
[CONSOLE] 📡 Waiting for browser connections...
[DEV] ▲ Next.js 15.3.3
[DEV] - Local:        http://localhost:3000
[CONSOLE] 📱 Browser connected [abc123def] - Total clients: 1
[CONSOLE] [14:30:25] INFO: 🔗 Browser console connected to terminal
[CONSOLE] [14:30:26] ERROR: QuotaExceededError: Failed to execute 'setItem'...
[CONSOLE] [14:30:26] LOG: Cache size limit reached (150), cleaning up old entries
```

## Technical Details

- **Browser Side**: `TerminalConsole.tsx` component intercepts console methods
- **Server Side**: `console-server.js` WebSocket server receives and formats logs
- **Auto-reconnection**: Browser automatically reconnects if connection drops
- **Development Only**: Console monitoring only runs in development mode

## Troubleshooting

### Console Server Won't Start
- Check if port 3001 is available
- Kill any existing processes: `lsof -ti:3001 | xargs kill`

### Browser Not Connecting
- Refresh the browser page
- Check browser console for WebSocket connection errors
- Ensure both servers are running

### No Logs Appearing
- Verify the TerminalConsole component is loaded in the app
- Check that you're in development mode (`NODE_ENV=development`)
- Look for connection messages in terminal

## Future Instructions

**For AI Assistants**: When a user asks you to monitor their console in the future, simply tell them:

> "Run `npm run dev` and I'll be able to see your console logs directly in the terminal using the `read-terminal` tool."

This eliminates the need for manual copy/paste of console output and provides real-time debugging capabilities.
