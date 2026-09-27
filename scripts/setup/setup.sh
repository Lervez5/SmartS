#!/usr/bin/env bash
set -euo pipefail

# School OS - Development Setup Script
# Bootstraps a fresh development environment from scratch.

echo "⚙️  School OS - Development Setup"
echo "=================================="

# Check prerequisites
echo "📋 Checking prerequisites..."

command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v pnpm >/dev/null 2>&1 || { echo "❌ pnpm is required. Install with: npm install -g pnpm@10.33.2"; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "⚠️  Docker is recommended for MongoDB and Redis."; }

echo "✅ Node $(node --version)"
echo "✅ pnpm $(pnpm --version)"

# Copy environment file
echo "📄 Setting up environment..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "   Created .env from .env.example"
  echo "   Please review and update .env as needed."
else
  echo "   .env already exists, skipping."
fi

# Start Docker services (MongoDB, Redis)
echo "🐳 Starting Docker services..."
if command -v docker &>/dev/null && command -v docker-compose &>/dev/null; then
  docker-compose up -d mongodb redis
  echo "   MongoDB and Redis started."
else
  echo "   ⚠️  Docker not available. Please start MongoDB and Redis manually."
  echo "   MongoDB should run as a replica set: mongod --replSet rs0"
  echo "   MongoDB init: mongosh --eval 'rs.initiate({_id:\"rs0\",members:[{_id:0,host:\"localhost:27017\"}]})'"
  echo "   Redis should run on localhost:6379"
fi

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
pnpm --filter school-os-api prisma:generate

# Build packages
echo "🏗️  Building packages..."
pnpm --filter @schoolos/config... build 2>/dev/null || echo "   (config package build skipped)"
pnpm --filter @schoolos/ui... build 2>/dev/null || echo "   (ui package build skipped)"
pnpm --filter @schoolos/utils... build 2>/dev/null || echo "   (utils package build skipped)"
pnpm --filter @schoolos/types... build 2>/dev/null || echo "   (types package build skipped)"
pnpm --filter @schoolos/validation... build 2>/dev/null || echo "   (validation package build skipped)"
pnpm --filter @schoolos/auth... build 2>/dev/null || echo "   (auth package build skipped)"

# Build API
echo "🏗️  Building API..."
pnpm --filter school-os-api build

# Seed admin user
echo "🌱 Seeding admin user..."
pnpm --filter school-os-api exec node dist/scripts/seed-admin.js 2>/dev/null || echo "   (seeding script not yet available, skipping)"

echo ""
echo "✅ Setup complete!"
echo ""
echo "To start development:"
echo "  pnpm dev        # all services in parallel via turbo"
echo "  pnpm dev -- --filter school-os-api  # API only"
echo "  pnpm dev -- --filter school-os-parent  # parent app only"
echo ""
echo "Services:"
echo "  API:        http://localhost:4000"
echo "  Parent:     http://localhost:3000"
echo "  Student:    http://localhost:3001"
echo "  Teacher:    http://localhost:3002"
echo "  Admin:      http://localhost:3003"
echo "  MongoDB:    mongodb://localhost:27017/schoolos?replicaSet=rs0"
echo "  Redis:      redis://localhost:6379"