#!/bin/bash

# ensure-port-3000.sh
# This script ensures that port 3000 is available for the development server
# It will:
# 1. Check if port 3000 is in use
# 2. If it is, identify the process and kill it
# 3. Start the development server on port 3000

# Text formatting
BOLD='\033[1m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BOLD}${BLUE}WeWrite Port 3000 Manager${NC}"
echo "Ensuring development server runs on port 3000..."

# Function to check if port 3000 is in use
check_port() {
  if command -v lsof >/dev/null 2>&1; then
    PORT_INFO=$(lsof -i :3000 -P -n 2>/dev/null)
    if [ -n "$PORT_INFO" ]; then
      echo -e "${YELLOW}Port 3000 is currently in use:${NC}"
      echo "$PORT_INFO"
      return 0 # Port is in use
    else
      echo -e "${GREEN}Port 3000 is available.${NC}"
      return 1 # Port is not in use
    fi
  else
    echo -e "${YELLOW}lsof command not found. Using alternative method to check port.${NC}"
    if nc -z localhost 3000 >/dev/null 2>&1; then
      echo -e "${YELLOW}Port 3000 is currently in use.${NC}"
      return 0 # Port is in use
    else
      echo -e "${GREEN}Port 3000 is available.${NC}"
      return 1 # Port is not in use
    fi
  fi
}

# Function to kill process on port 3000
kill_process() {
  echo -e "${YELLOW}Attempting to kill process on port 3000...${NC}"
  
  # Try using kill-port npm package if available
  if command -v npx >/dev/null 2>&1; then
    echo "Using npx kill-port..."
    npx kill-port 3000
    sleep 1
  fi
  
  # If that didn't work, try using lsof and kill
  if command -v lsof >/dev/null 2>&1; then
    PID=$(lsof -t -i:3000 -P -n 2>/dev/null)
    if [ -n "$PID" ]; then
      echo "Found process with PID: $PID"
      echo "Killing process..."
      kill -9 $PID
      sleep 1
    fi
  fi
  
  # Check if port is now available
  if check_port; then
    echo -e "${RED}Failed to free port 3000. Please manually kill the process.${NC}"
    return 1
  else
    echo -e "${GREEN}Successfully freed port 3000.${NC}"
    return 0
  fi
}

# Function to start the development server
start_server() {
  echo -e "${BLUE}Starting development server on port 3000...${NC}"
  npm run dev
}

# Main execution
if check_port; then
  echo -e "${YELLOW}Port 3000 is in use. Attempting to free it...${NC}"
  if kill_process; then
    start_server
  else
    echo -e "${RED}Could not free port 3000. Please manually kill the process and try again.${NC}"
    exit 1
  fi
else
  start_server
fi
