#!/bin/bash

MAX_RETRIES=3
RETRY_DELAY=5
ATTEMPTS=0

start_server() {
    # Kill any existing processes on port 3000
    echo "Cleaning up port 3000..."
    npx kill-port 3000 2>/dev/null || true

    # Wait a moment for the port to be fully released
    sleep 1

    # Start the development server
    npm run dev
}

while [ $ATTEMPTS -lt $MAX_RETRIES ]; do
    ATTEMPTS=$((ATTEMPTS + 1))
    
    if [ $ATTEMPTS -gt 1 ]; then
        echo "Retry attempt $ATTEMPTS of $MAX_RETRIES..."
        sleep $RETRY_DELAY
    fi

    echo "Starting development server..."
    start_server &
    SERVER_PID=$!

    # Wait for the server to start or fail
    WAIT_TIME=0
    while [ $WAIT_TIME -lt 30 ]; do
        if curl -s http://localhost:3000 >/dev/null; then
            echo "Server started successfully!"
            wait $SERVER_PID
            exit 0
        fi

        # Check if the process is still running
        if ! kill -0 $SERVER_PID 2>/dev/null; then
            echo "Server failed to start."
            break
        fi

        sleep 1
        WAIT_TIME=$((WAIT_TIME + 1))
    done

    # Kill the server if it's still running but not responding
    if kill -0 $SERVER_PID 2>/dev/null; then
        kill $SERVER_PID
    fi
done

echo "Failed to start server after $MAX_RETRIES attempts."
exit 1