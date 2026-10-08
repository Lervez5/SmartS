# School OS Frontend Migration Guide

## Overview

This document outlines the migration process for consolidating frontend applications (admin, parent, student, teacher) into a unified system with shared UI components, theming, authentication, and role-based access control.

## Current State

### Applications

- **Admin Portal** (`apps/admin`) - School administration (port 3003)
- **Parent Portal** (`apps/parent`) - Guardian access (port 3000)
- **Student Portal** (`apps/student`) - Learner access (port 3001)
- **Teacher Portal** (`apps/teacher`) - Teaching staff access (port 3002)

### Shared Packages

- **@schoolos/ui** - Shared React components
- **@schoolos/auth** - Authentication and authorization
- **@schoolos/types** - TypeScript type definitions
- **@schoolos/validation** - Zod validation schemas
- **@schoolos/config** - Runtime configuration
- **@schoolos/utils** - Utility functions
- **@schoolos/hooks** - Shared React hooks (NEW)
- **@schoolos/tailwind** - Tailwind CSS configuration

## Completed Tasks

### 1. ✅ Monorepo Integration

- Updated package.json files to use workspace dependencies
- Configured proper Next.js settings for each app
- Standardized TypeScript configurations across all apps
- Extracted components from frontend-kids to shared packages

### 2. ✅ Shared UI Components

Extracted layout components to `@schoolos/ui`:

- **Navbar** - Responsive navigation bar with search, notifications, user menu
- **Sidebar** - Role-based navigation with mobile support
- **LayoutWrapper** - Main layout wrapper with mobile menu handling
- **Navigation** - Pre-configured navigation for each role

Added form components:

- **Input** - Text input with label and error handling
- **Select** - Dropdown selection component
- **Checkbox** - Checkbox with label
- **Textarea** - Multi-line text input

Added data display components:

- **Avatar** - User avatar with fallback
- **Badge** - Status and category badges
- **Table** - Complete table component with header, body, rows, cells

### 3. ✅ Role-Based System

- Updated `@schoolos/types` with comprehensive role definitions
- Added `ROLE_PERMISSIONS` mapping for each user role
- Added `PERMISSION_DOMAINS` for organized permission management
- Added `ROLE_DESCRIPTIONS` for documentation
- Enhanced `@schoolos/auth` with permission constants

**Role Permissions:**

- **super_admin**: Full system access
- **school_admin**: School management permissions
- **teacher**: Classroom and student management
- **parent**: Child information and communications
- **student**: Classes, assignments, and grades access

### 4. ✅ Shared Hooks Package

Created `@schoolos/hooks` with domain-specific hooks:

- `useAttendance` - Attendance management (teacher/student/admin)
- `useCalendar` - Calendar and scheduling
- `useCohorts` - Class/cohort management
- `useCourses` - Course and learning management
- `useDashboard` - Dashboard metrics
- `useGamification` - Gamification features
- `useMetrics` - Platform metrics
- `useReporting` - Report generation
- `useSubjects` - Subject management
- `useUsers` - User management

### 5. ✅ Consistent Theming

- Standardized Tailwind configuration across all apps
- Unified CSS variables for colors, spacing, typography
- Consistent theme with green primary color (#16a34a)
- Dark mode support across all applications
- Glass morphism effects for modern UI

### 6. ✅ Navigation Configuration

Pre-configured navigation for each role:

- **adminNavigation**: Dashboard, Users, Classes, Finance, Attendance, Reports, Settings
- **parentNavigation**: Dashboard, My Children, Fees & Payments, Announcements, Messages, Calendar
- **studentNavigation**: Dashboard, My Classes, Assignments, My Grades, Schedule, Announcements
- **teacherNavigation**: Dashboard, My Classes, Assignments, Gradebook, Attendance, Calendar

## Next Steps

### 1. App-Specific Layout Implementation

Each app needs to implement role-specific layouts using the shared components:

```tsx
// Example for admin app
import { RoleLayout } from '@schoolos/auth';
import { adminNavigation } from '@schoolos/ui';

export default function AdminLayout({ children }) {
  return (
    <RoleLayout
      role="admin"
      user={currentUser}
      isAuthenticated={isAuthenticated}
      onLogout={handleLogout}
    >
      {children}
    </RoleLayout>
  );
}
```

### 2. Auth Store Integration

Each app needs to integrate with the shared auth system:

- Create app-specific auth stores using Zustand
- Connect to shared auth utilities
- Implement JWT token management
- Handle role-based access control

### 3. API Integration

Update API calls to use shared hooks:

- Replace direct axios calls with `@schoolos/hooks`
- Configure proper API URLs via environment variables
- Implement error handling and loading states
- Add optimistic updates where appropriate

### 4. Component Migration

Migrate app-specific components to use shared UI:

- Replace custom buttons with shared Button component
- Use shared form components for consistency
- Implement shared data display components
- Ensure responsive design across all apps

### 5. Testing and Validation

- Test each app with different user roles
- Verify permission-based access control
- Ensure consistent theming across all apps
- Test mobile responsiveness
- Validate API integrations

### 6. Documentation Updates

- Update app-specific README files
- Document component usage patterns
- Create role-based access documentation
- Add API integration examples

## Port Configuration

- **Parent Portal**: <http://localhost:3000>
- **Student Portal**: <http://localhost:3001>
- **Teacher Portal**: <http://localhost:3002>
- **Admin Portal**: <http://localhost:3003>
- **API**: <http://localhost:4000>

### Component Organization

- **Shared Components**: Located in `packages/ui/src/components/`
- **App-Specific Components**: Remain in individual `apps/*/src/components/`
- **Layout Components**: Shared via `@schoolos/ui` but configured per app
- **Domain Hooks**: Shared via `@schoolos/hooks` for cross-app reuse

### Role-Based Access

- **Permissions**: Defined centrally in `@schoolos/types`
- **Navigation**: Configured per role in `@schoolos/ui`
- **Layout Components**: Generic with role-specific configuration
- **Access Control**: Implemented at component and route level

### Theming Strategy

- **CSS Variables**: Centralized in shared globals.css
- **Tailwind Config**: Standardized across all apps
- **Dark Mode**: Supported via next-themes
- **Brand Colors**: Consistent green (#16a34a) across all apps

## Port Configuration

- **Student Portal**: <http://localhost:3000>
- **Parent Portal**: <http://localhost:3001>
- **Teacher Portal**: <http://localhost:3002>
- **Admin Portal**: <http://localhost:3003>
- **API**: <http://localhost:4000>

## Environment Configuration

Each app should configure the following environment variables:

```env
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_APP_NAME=<App Name>
NEXT_PUBLIC_ROLE=<role>
```

## Development Workflow

1. **Install Dependencies**: `pnpm install`
2. **Start All Apps**: `pnpm dev`
3. **Run Specific App**: `pnpm --filter <app-name> dev`
4. **Build All**: `pnpm build`
5. **Type Check**: `pnpm typecheck`
6. **Lint**: `pnpm lint`

## Current Architecture

```bash
apps/
├── admin/     (port 3003) - School administration
├── parent/    (port 3001) - Guardian access
├── student/   (port 3000) - Learner access
└── teacher/   (port 3002) - Teaching staff

packages/
├── ui/        - Shared React components
├── auth/      - Authentication & authorization
├── types/     - TypeScript definitions
├── hooks/     - Shared React hooks
├── validation/- Zod schemas
├── config/    - Runtime configuration
├── utils/     - Utility functions
└── tailwind/  - CSS configuration
```

## Troubleshooting

### Common Issues

1. **Missing Dependencies**: Run `pnpm install` to ensure all workspace dependencies are installed
2. **Tailwind Not Working**: Verify tailwind.config.ts includes shared UI paths
3. **Type Errors**: Ensure `@schoolos/types` is properly imported
4. **Theme Issues**: Check that globals.css is imported in each app's layout

### Migration Issues

1. **Import Paths**: Update imports from local to shared packages
2. **Component Props**: Ensure props match shared component interfaces
3. **Auth State**: Verify auth store integration with shared utilities
4. **API Calls**: Replace direct calls with shared hooks

## Conclusion

This migration establishes a solid foundation for consistent UI, authentication, and role-based access control across all School OS applications. The shared package architecture allows for rapid development while maintaining consistency and reducing code duplication.

For questions or issues, refer to the individual package documentation or contact the development team.
