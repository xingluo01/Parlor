#!/usr/bin/env bash
set -e

echo ""
echo "  Starting Parlor..."
echo ""

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "  [ERROR] Node.js is not installed."
    echo "  Download it from https://nodejs.org/ (v18 or newer)"
    echo ""
    exit 1
fi

# Check Node version (need 18+)
NODE_VER=$(node -v | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_VER" -lt 18 ]; then
    echo "  [ERROR] Node.js 18+ is required. You have v${NODE_VER}."
    echo "  Download a newer version from https://nodejs.org/"
    echo ""
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies..."
    echo ""
    npm install
    echo ""
fi

# Build frontend (always rebuild to pick up any source changes)
echo "  Building Parlor..."
echo ""
npm run build
echo ""

# Kill any existing server on port 3001
EXISTING_PID=$(lsof -ti:3001 2>/dev/null || netstat -ano 2>/dev/null | grep ':3001.*LISTEN' | awk '{print $NF}')
if [ -n "$EXISTING_PID" ]; then
    echo "  Stopping previous server (PID $EXISTING_PID)..."
    kill "$EXISTING_PID" 2>/dev/null || taskkill //F //PID "$EXISTING_PID" 2>/dev/null
    sleep 1
fi

# Start the server
echo "  Parlor is running at http://localhost:3001"
echo "  Press Ctrl+C to stop."
echo ""
node server.cjs
