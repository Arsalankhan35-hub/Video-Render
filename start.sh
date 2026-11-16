#!/bin/sh
set -eu
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install Node.js 18 or newer from https://nodejs.org/" >&2
  exit 1
fi
node_major=$(node -p "Number(process.versions.node.split('.')[0])")
if [ "$node_major" -lt 18 ]; then
  echo "Node.js 18 or newer is required (found $(node --version))." >&2
  exit 1
fi
npm start
