#!/bin/bash
# Development script that properly handles Ctrl+C to kill all child processes

set -e

# Trap SIGINT (Ctrl+C) and SIGTERM to kill all child processes
trap 'kill $(jobs -p) 2>/dev/null; exit 1' INT TERM

# Run turbo dev
pnpm turbo run dev

# Wait for all background jobs
wait