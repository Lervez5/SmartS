<#
.SYNOPSIS
    One-shot setup script for Smart School OS on Windows (PowerShell).

.DESCRIPTION
    This script prepares a fresh checkout for development on Windows:
      1. Stops any process already listening on the project ports.
      2. Kills lingering Node/TSX/PNPM processes from prior runs.
      3. Creates a .env file from .env.example if one doesn't exist.
      4. Generates the Prisma client.
      5. Starts MongoDB replica set (via Docker) if not running.
      6. Pushes the Prisma schema to the database.

    The script is **idempotent** — you can re-run it safely.

    Ports used by the project:
      3000  – Admin
      3001  – Student
      3002  – Teacher
      3003  – Parent
      4000  – API

.NOTES
    Requires:
      • Docker Desktop (for MongoDB replica set)
      • Node 20+
      • pnpm 9+

    Run from the repository root:
      .\scripts\setup-dev.ps1
#>
param(
    [switch]$SkipMongo = $false
)

$ErrorActionPreference = 'Stop'

function Write-Step($msg) {
    Write-Host ""
    Write-Host "=== $msg ===" -ForegroundColor Cyan
}

function Write-Ok($msg)  { Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "[ERR]  $msg" -ForegroundColor Red }

# ── Ports to free ──────────────────────────────────────────────
$Ports = @(3000, 3001, 3002, 3003, 4000)

Write-Step "1. Freeing ports $( $Ports -join ', ' )"

foreach ($port in $Ports) {
    try {
        $listeners = netstat -ano 2>$null | Select-String ":$port `"
        if ($listeners) {
            $pids = $listeners | ForEach-Object {
                ($_ -split '\s+')[-1]
            } | Sort-Object -Unique
            foreach ($pid in $pids) {
                if ($pid -and $pid -ne '0') {
                    Write-Host "  Killing PID $pid on port $port ..."
                    Stop-Process -Id $pid -Force -ErrorAction SilentlyContinue
                }
            }
            Start-Sleep -Milliseconds 500
        }
    } catch {
        Write-Warn "  Could not check port $port, continuing…"
    }
}

Write-Ok "Ports freed"

# ── Kill lingering Node processes ──────────────────────────────
Write-Step "2. Killing lingering Node / PNPM / TSX processes"

$killNames = @('node', 'pnpm', 'pnpm-filter', 'tsx', 'next')
foreach ($name in $killNames) {
    try {
        $procs = Get-Process -Name $name -ErrorAction SilentlyContinue
        if ($procs) {
            $procs | Stop-Process -Force -ErrorAction SilentlyContinue
        }
    } catch {
        # ignore
    }
}
Start-Sleep -Milliseconds 500
Write-Ok "Lingering processes stopped"

# ── .env file ──────────────────────────────────────────────────
Write-Step "3. Ensuring .env exists"

if (-Not (Test-Path .\.env)) {
    if (Test-Path .\.env.example) {
        Copy-Item .\.env.example .\.env
        Write-Ok "Created .env from .env.example"
    } else {
        Write-Err ".env.example not found. Please create .env manually."
        exit 1
    }
} else {
    Write-Ok ".env already exists"
}

# Ensure DATABASE_URL is set in .env for the dev database
$envContent = Get-Content .\.env -Raw
if ($envContent -match 'DATABASE_URL=(mongodb|postgresql)') {
    Write-Ok ".env has DATABASE_URL set"
} else {
    # Append a default
    $envContent += "`nDATABASE_URL=mongodb://localhost:27017/schoolos?replicaSet=rs0`n"
    Set-Content .\.env $envContent
    Write-Ok "Added DATABASE_URL to .env"
}

# ── Docker / MongoDB replica set ───────────────────────────────
if (-not $SkipMongo) {
    Write-Step "4. Starting MongoDB replica set (via Docker)"

    try {
        $dockerRunning = docker info 2>$null
        if ($LASTEXITCODE -eq 0) {
            # Check if a container named schoolos-mongo already exists
            $existing = docker ps -a --format '{{.Names}}' | Where-Object { $_ -eq 'schoolos-mongo' }
            if ($existing) {
                Write-Host "  MongoDB container already exists. Starting…"
                docker start schoolos-mongo 2>$null
                Write-Ok "MongoDB container started"
            } else {
                Write-Host "  Creating and starting MongoDB replica set container…"
                docker run -d `
                    --name schoolos-mongo `
                    -p 27017:27017 `
                    mongo:7 --replSet rs0 2>$null

                Start-Sleep -Seconds 3
                Write-Host "  Initialising replica set…"
                docker exec schoolos-mongo mongo --eval '
                    rs.reconfig(
                        { _id: "rs0", members: [ { _id: 0, host: "localhost:27017" } ] },
                        { force: true }
                    )
                ' 2>$null
                Write-Ok "MongoDB replica set initialised"
            }
            Start-Sleep -Seconds 3
        }
    } catch {
        Write-Warn "Docker not available or MongoDB already running. Ensure MongoDB is accessible at localhost:27017 with replicaSet=rs0."
    }
}

# ── Prisma generate ────────────────────────────────────────────
Write-Step "5. Generating Prisma client"
try {
    pnpm --filter school-os-api prisma:generate 2>&1 | ForEach-Object { Write-Host $_ }
    Write-Ok "Prisma client generated"
} catch {
    Write-Warn "Prisma generate encountered issues — continuing anyway"
}

# ── Prisma db push ─────────────────────────────────────────────
Write-Step "6. Pushing Prisma schema to database"
try {
    pnpm --filter school-os-api db:push 2>&1 | ForEach-Object { Write-Host $_ }
    Write-Ok "Database schema pushed"
} catch {
    Write-Warn "Database push failed — check your DATABASE_URL and MongoDB connection"
}

# ── Seed (optional, comment out if not needed) ─────────────────
Write-Step "7. Seeding database (if configured)"
try {
    pnpm seed 2>&1 | ForEach-Object { Write-Host $_ }
    Write-Ok "Database seeded"
} catch {
    Write-Warn "Seed failed or not configured — continuing"
}

Write-Step "8. Done!"
Write-Host ""
Write-Host "Setup complete. Start the dev servers with:"
Write-Host "  pnpm dev        # all services" -ForegroundColor Green
Write-Host "  pnpm dev:api    # API only"
Write-Host "  pnpm dev:admin  # Admin portal only"
Write-Host "  pnpm dev:teacher # Teacher portal only"
Write-Host ""
Write-Host "Open in browser:"
Write-Host "  http://localhost:3000  (Admin)"
Write-Host "  http://localhost:3001  (Student)"
Write-Host "  http://localhost:3002  (Teacher)"
Write-Host "  http://localhost:3003  (Parent)"
Write-Host "  http://localhost:4000  (API)"
Write-Host ""
