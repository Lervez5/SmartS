# SmartSprout 🧠🌱

SmartSprout is a premium, AI-powered primary education platform. It provides a robust, role-aware ecosystem for **Students**, **Parents**, **Staff**, and **Administrators** to engage in a gamified learning experience.

## ✨ Core Features

### 🔐 Advanced Authentication & RBAC
- **JWT-Powered Auth**: Secure session management using HTTP-only cookies.
- **Role-Based Access Control**: Granular permissions across the platform (Admin, Staff, Parent, Student).
- **Protected Routes**: Middleware-level security for both Backend and Frontend (Next.js Middleware).

### 👤 Profile & Identity Management
- **Personalized Dashboards**: Unique experiences tailored specifically to each user role.
- **Dynamic Profiles**: Manage first names, last names, and contact information.
- **Photo Upload System**: Direct file upload with instant preview for user avatars.

### 🎮 Gamified Learning
- **Achievements & Badges**: rewarding system to keep students engaged.
- **Progress Tracking**: Real-time analytics and audit logs for parents and staff.

## 🏗 Architecture & Requirements

SmartSprout is built as a highly scalable monorepo:
- **Backend**: Node.js + Express + Prisma + MongoDB (Replica Set required).
- **AI Engine**: Python + FastAPI for intelligent content generation.
- **Frontend**: Next.js (App Router) + Tailwind CSS + Framer Motion.

### 🔌 MongoDB Replica Set (CRITICAL)
Our authentication and provisioning flows rely on **Nested Prisma Transactions**. This strictly requires a MongoDB Replica Set configuration.

1. **Configure:** Edit `/etc/mongod.conf`:
    ```yaml
    replication:
      replSetName: "rs0"
    ```
2. **Restart:** `sudo systemctl restart mongod`
3. **Initiate:** `mongosh --eval "rs.initiate()"`

## 🚀 Getting Started

1. **Install Dependencies**:
   ```bash
   pnpm install
   ```
2. **Database Sync**:
   ```bash
   cd backend && pnpm db:push
   ```
3. **Provision Superadmin**:
   Required for initial setup and user provisioning:
   ```bash
   cd backend && pnpm run seed:admin
   ```
   *Default: `admin@smartsprout.com` | `supersecret`*

4. **Launch Platform**:
   ```bash
   pnpm run dev
   ```

## 🛠 Project Structure
```text
.
├── backend          # Express API & Prisma Service
├── ai_engine        # Python AI Intelligence
├── frontend-kids    # Main Interactive Web App
└── docs             # Technical Documentation
```



