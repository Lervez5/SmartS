# 🌿 SmartSprout Developer Guide

Welcome to the **SmartSprout** ecosystem! This document will help you navigate our high-performance, AI-driven education platform.

## 🏗 Architecture Overview

SmartSprout is built as a highly-available monorepo, designed for scale and developer experience.

### 🧩 Core Components
| Component | Stack | Responsibility |
| :--- | :--- | :--- |
| **Backend** | Node.js, Express, Prisma, **MongoDB** | Core business logic, secure API, Auth, and Data orchestration. |
| **AI Engine** | Python, FastAPI, Uvicorn | Skill estimation, content recommendations, and adaptive scoring. |
| **Frontend** | Next.js 14, React, Tailwind CSS | Premium, gamified interfaces mapped uniquely to user roles. |

## 🚀 Environment Setup

### 1. Database Specifications
Because SmartSprout utilizes advanced **Prisma Transactions** for resilient data creation (such as linking a `Parent` entity to multiple `Child` students simultaneously), our MongoDB cluster **MUST run in a Replica Set**.

If running bare-metal, add `replSetName: "rs0"` to your `mongod.conf` and execute `rs.initiate()`.

### 2. Unified Dev Orchestration
We use a custom orchestration script to run everything.
```bash
pnpm run dev
```
This starts the backend, frontend, and AI engine concurrently with hot data reloading.

## 🔐 Security & Identity Modules

SmartSprout relies on explicit Role-Based Access Control (`RBAC`) connected to JWT HttpOnly Secure cookies.

### Provisioning Accounts
1.  **Public App** (`/register`): The public registration route is strictly scoped to the `parent` and `student` enum values. Malicious requests attempting to pass `role: admin` will be rejected by Zod Schema Validation.
2.  **Superadmin Seed**: To provision administrative accounts, the system provides a CLI seeding script. Run `pnpm run seed:admin` inside `/backend` to generate the root credentials.
3.  **Dynamic Command Center** (`/admin`): Authenticated admins access the bespoke "AdminView". This React component fetches live `users` and `AuditLog` history via protected backend endpoints.

## 🎨 Design System: "Sprout Glass"
Our frontend uses a custom-built design system called **Sprout Glass**.

- **Aesthetic**: Glassmorphism with modern blurs and sharp typography.
- **Colors**: Curated `brand` greens (`#16a34a`) paired with deep slate accents.
- **Motion**: Powered by `framer-motion` for organic, playful transitions.

---
*Built with ❤️ for the next generation of sprouts.*
