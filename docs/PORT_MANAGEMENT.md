# WeWrite Port Management

This document explains the port management strategy for the WeWrite development environment.

## Port 3000 Policy

For consistency in testing and development, WeWrite always uses port 3000 for the development server. This ensures that:

1. All developers are working with the same URL (`http://localhost:3000`)
2. Documentation and instructions remain consistent
3. Testing procedures are standardized
4. Browser bookmarks and saved states work reliably

## Using the Port Management Tools

### Option 1: Use the port management script

We've created a dedicated script that handles port conflicts automatically:

```bash
npm run dev:port
```

This script will:
1. Check if port 3000 is already in use
2. If it is, identify and kill the process using that port
3. Start the development server on port 3000

### Option 2: Use the safe development script

The safe development script also handles port conflicts and includes additional retry logic:

```bash
npm run dev:safe
```

### Option 3: Manual port management

If you need to manually manage ports:

1. Find processes using port 3000:
   ```bash
   lsof -i :3000
   ```

2. Kill the process:
   ```bash
   kill -9 [PID]
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

## Troubleshooting

If you encounter issues with port 3000:

1. **Port in use error**: Use `npm run dev:port` to automatically handle the conflict

2. **Permission denied**: You may need to run the kill command with sudo:
   ```bash
   sudo kill -9 [PID]
   ```

3. **Process won't terminate**: Try force quitting the application that's using the port (often a browser or another Node.js process)

4. **Port still in use after killing**: Some processes may take a moment to fully release the port. Wait a few seconds and try again.

## Why Not Use Alternative Ports?

While Next.js allows using alternative ports (e.g., `next dev -p 3001`), we've standardized on port 3000 to ensure consistency across all development environments. This makes it easier to:

- Share development URLs
- Follow documentation
- Debug issues
- Maintain consistent testing procedures

If you absolutely must use a different port temporarily, please communicate this clearly to the team and switch back to port 3000 as soon as possible.
