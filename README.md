# 🔐 Secure Task Management System with RBAC

A full-stack task management application featuring **Role-Based Access Control (RBAC)**, **JWT authentication**, and **comprehensive audit logging** built with NestJS, Angular, and SQLite.

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#%EF%B8%8F-architecture)
- [Tech Stack](#%EF%B8%8F-tech-stack)
- [Quick Start](#-quick-start)
- [API Documentation](#-api-documentation)
- [RBAC System](#-rbac-system)
- [Testing Guide](#-testing-guide)
- [Project Structure](#-project-structure)
- [Development Time Log](#%EF%B8%8F-development-time-log)

---

## ✨ Features

### Core Functionality
- ✅ **JWT Authentication** - Secure login with bcrypt password hashing
- ✅ **Role-Based Access Control (RBAC)** - 3 roles with granular permissions
- ✅ **Task Management** - Full CRUD operations with organization isolation
- ✅ **Audit Logging** - Complete tracking of all system actions
- ✅ **Organization Isolation** - Multi-tenant architecture
- ✅ **Permission Guards** - Decorator-based authorization

### Security Features
- 🔒 Password hashing with bcrypt
- 🔐 JWT tokens with 24-hour expiration
- 🛡️ Permission-based route protection
- 📝 Comprehensive audit trail
- 🏢 Organization-level data isolation

---

## 🏗️ Architecture

### NX Monorepo Structure
```
ftahmid-bcd36a19-7dca-4b0b-ba2f-a8c55e8071f0/
│
├── api/                                # NestJS Backend (Port 3333)
│   └── src/
│       ├── auth/                       # JWT authentication & guards
│       │   ├── jwt.strategy.ts         # JWT validation strategy
│       │   ├── jwt-auth.guard.ts       # Route protection
│       │   ├── permissions.guard.ts
│       │   ├── permissions.decorator.ts
│       │   └── current-user.decorator.ts
│       │
│       ├── tasks/                      # Task management
│       │   ├── tasks.controller.ts
│       │   └── tasks.service.ts
│       │
│       ├── entities/                   # TypeORM entities
│       │   ├── user.entity.ts
│       │   ├── role.entity.ts
│       │   ├── permission.entity.ts
│       │   ├── task.entity.ts
│       │   ├── organization.entity.ts
│       │   └── audit-log.entity.ts
│       │
│       ├── database/
│       │   └── seeds/                  # Database seeding
│       │
│       ├── services/
│       │   └── audit.service.ts        # Audit logging
│       │
│       └── controllers/
│           └── audit.controller.ts
│
├── dashboard/                          # Angular Frontend (Port 4200)
│
├── data/                               # Shared TypeScript interfaces
│
├── taskmanagement.db                   # SQLite database
│
└── README.md
```

---

## 🛠️ Tech Stack

### Backend
- **NestJS 10** - Progressive Node.js framework
- **TypeORM** - ORM with SQLite
- **Passport JWT** - JWT authentication
- **bcrypt** - Password hashing

### Frontend
- **Angular 18** - Modern web framework
- **TailwindCSS** - Utility-first CSS

### Development
- **NX 19** - Monorepo build system
- **TypeScript** - Type safety
- **SQLite** - Embedded database

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm

### Installation
```bash
# 1. Install dependencies
npm install

# 2. Start the backend API
npx nx serve api
# API runs at: http://localhost:3333/api

# 3. Seed the database (in a new terminal)
curl -X POST http://localhost:3333/api/seed

# 4. Start the frontend (optional)
npx nx serve dashboard
# Frontend runs at: http://localhost:4200
```

### Test Login Credentials

| Role   | Email                    | Password     | Permissions                        |
|--------|--------------------------|--------------|-------------------------------------|
| Owner  | owner@techcorp.com       | password123  | Full system access + user mgmt      |
| Admin  | admin@techcorp.com       | password123  | Task CRUD + most operations         |
| Viewer | viewer@techcorp.com      | password123  | Read-only (assigned tasks only)     |

---

## 📡 API Documentation

### Base URL
```
http://localhost:3333/api
```

### Authentication

#### Login
```bash
POST /auth/login
Content-Type: application/json

{
  "email": "owner@techcorp.com",
  "password": "password123"
}

Response:
{
  "access_token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "owner@techcorp.com",
    "role": { "name": "owner", "permissions": [...] }
  }
}
```

#### Register
```bash
POST /auth/register
Content-Type: application/json

{
  "email": "newuser@company.com",
  "password": "securepass123",
  "name": "John Doe",
  "organizationName": "My Company"
}
```

### Tasks

All endpoints require: `Authorization: Bearer <token>`

#### List Tasks
```bash
GET /tasks

# Owner/Admin: See all organization tasks
# Viewer: Only sees assigned tasks
```

#### Get Single Task
```bash
GET /tasks/:id
```

#### Create Task
```bash
POST /tasks
Content-Type: application/json

{
  "title": "Implement feature X",
  "description": "Build new feature",
  "status": "pending",
  "priority": "high",
  "dueDate": "2025-12-31"
}

# Requires: tasks:create permission
```

#### Update Task
```bash
PUT /tasks/:id
Content-Type: application/json

{
  "status": "in-progress",
  "priority": "medium"
}

# Requires: tasks:update permission
```

#### Delete Task
```bash
DELETE /tasks/:id

# Requires: tasks:delete permission
```

### Audit Logs
```bash
GET /audit-log

# Requires: audit:read permission (Owner/Admin only)
# Returns: Last 100 audit entries for the organization
```

### Error Responses
```json
// 401 Unauthorized
{
  "statusCode": 401,
  "message": "Unauthorized"
}

// 403 Forbidden
{
  "statusCode": 403,
  "message": "You need the following permissions: tasks:create",
  "error": "Forbidden"
}

// 404 Not Found
{
  "statusCode": 404,
  "message": "Task not found"
}
```

---

## 🔐 RBAC System

### Role Hierarchy
```
┌─────────────────────────────────────────────────┐
│                    OWNER                        │
│  ✓ All Permissions                              │
│  ✓ User Management (create, read, update, del) │
│  ✓ Audit Log Access                             │
│  ✓ Task Management (full CRUD)                  │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│                    ADMIN                        │
│  ✓ Task Management (full CRUD)                  │
│  ✓ User Management (create, read, update)       │
│  ✓ Audit Log Access                             │
│  ✗ Cannot delete users                          │
└─────────────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────┐
│                   VIEWER                        │
│  ✓ Read assigned tasks only                     │
│  ✓ Read user information (limited)              │
│  ✗ Cannot create, update, or delete             │
│  ✗ Cannot access audit logs                     │
└─────────────────────────────────────────────────┘
```

### Permission Matrix

| Permission     | Owner | Admin | Viewer |
|----------------|-------|-------|--------|
| tasks:create   | ✅    | ✅    | ❌     |
| tasks:read     | ✅    | ✅    | ✅*    |
| tasks:update   | ✅    | ✅    | ❌     |
| tasks:delete   | ✅    | ✅    | ❌     |
| users:create   | ✅    | ✅    | ❌     |
| users:read     | ✅    | ✅    | ✅*    |
| users:update   | ✅    | ✅    | ❌     |
| users:delete   | ✅    | ❌    | ❌     |
| audit:read     | ✅    | ✅    | ❌     |

\* *Viewer can only read their own assigned tasks and limited user info*

### How RBAC Works

1. **User Login** → JWT token issued containing user ID
2. **Token Validation** → JWT strategy loads user with role & permissions
3. **Route Access** → Guards check if user has required permissions
4. **Action Performed** → Audit log records the action
5. **Data Isolation** → Only organization's data is accessible

---

## 🧪 Testing Guide

### Complete Test Suite
```bash
# 1. Seed database
curl -X POST http://localhost:3333/api/seed

# 2. Login as Owner
TOKEN=$(curl -s -X POST http://localhost:3333/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@techcorp.com","password":"password123"}' \
  | jq -r '.access_token')

# 3. List all tasks (Owner sees all)
curl -s http://localhost:3333/api/tasks \
  -H "Authorization: Bearer $TOKEN" | jq

# 4. Create a task
curl -s -X POST http://localhost:3333/api/tasks \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Task",
    "description": "Testing RBAC",
    "status": "pending",
    "priority": "high"
  }' | jq

# 5. View audit logs (Owner only)
curl -s http://localhost:3333/api/audit-log \
  -H "Authorization: Bearer $TOKEN" | jq

# 6. Test Viewer (Read-Only)
VIEWER_TOKEN=$(curl -s -X POST http://localhost:3333/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"viewer@techcorp.com","password":"password123"}' \
  | jq -r '.access_token')

# Viewer can read (only assigned tasks)
curl -s http://localhost:3333/api/tasks \
  -H "Authorization: Bearer $VIEWER_TOKEN" | jq

# Viewer CANNOT create (403 Forbidden)
curl -s -X POST http://localhost:3333/api/tasks \
  -H "Authorization: Bearer $VIEWER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Should Fail"}' | jq

# Viewer CANNOT access audit logs (403 Forbidden)
curl -s http://localhost:3333/api/audit-log \
  -H "Authorization: Bearer $VIEWER_TOKEN" | jq
```

### Expected Results

✅ **Owner**:
- Can create tasks
- Can view all organization tasks
- Can access audit logs
- Full system access

✅ **Admin**:
- Can create/update/delete tasks
- Can view audit logs
- Cannot delete users

✅ **Viewer**:
- Can only read assigned tasks
- **Blocked** from creating tasks (403)
- **Blocked** from audit logs (403)
- Read-only access

---

## 📂 Project Structure

### Key Files
```
api/src/
│
├── auth/
│   ├── jwt.strategy.ts          # Validates JWT & loads user with permissions
│   ├── permissions.guard.ts     # Checks if user has required permissions
│   └── auth.service.ts          # Login/register logic
│
├── tasks/
│   ├── tasks.controller.ts      # Protected routes with @Permissions()
│   └── tasks.service.ts         # Business logic with org isolation
│
├── entities/
│   ├── user.entity.ts           # User → Role → Permissions
│   ├── role.entity.ts           # ManyToMany with Permissions
│   ├── permission.entity.ts     # Individual permissions
│   └── audit-log.entity.ts      # Tracks all actions
│
└── services/
    └── audit.service.ts         # Logs user actions with metadata
```

---

## 🔍 Key Implementation Details

### JWT Authentication Flow
```typescript
// 1. User logs in
POST /auth/login → validates credentials

// 2. JWT token issued
{ sub: userId, email, iat, exp }

// 3. On each request
JWT Strategy → loads user with:
- relations: ['role', 'role.permissions', 'organization']

// 4. Guards check permissions
@Permissions('tasks:create')
→ PermissionsGuard validates user has permission
```

### Permission Guard
```typescript
@Controller('tasks')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TasksController {
  @Get()
  @Permissions('tasks:read')  // Only users with tasks:read can access
  findAll(@CurrentUser() user: User) {
    return this.tasksService.findAll(user);
  }
}
```

### Organization Isolation
```typescript
// Viewer only sees assigned tasks
if (user.role.name === 'viewer') {
  return this.taskRepo.find({
    where: { 
      assignedToId: user.id,
      organizationId: user.organizationId  // Org boundary
    }
  });
}

// Owner/Admin see all org tasks
return this.taskRepo.find({
  where: { organizationId: user.organizationId }
});
```

### Audit Logging
```typescript
// Every action is logged
await this.auditService.log({
  action: 'task:create',
  resource: 'task',
  resourceId: task.id,
  user: currentUser,
  ipAddress: request.ip,
  userAgent: request.headers['user-agent'],
  metadata: { title: task.title }
});
```

---

## 📊 Database Schema
```sql
-- Organizations
organizations (id, name, description, createdAt, updatedAt)

-- Roles with Permissions
roles (id, name, description)
permissions (id, name, description)
role_permissions (roleId, permissionId)

-- Users
users (id, email, password, name, firstName, lastName, roleId, organizationId)

-- Tasks
tasks (id, title, description, status, priority, dueDate, 
       assignedToId, createdById, organizationId)

-- Audit Logs
audit_logs (id, action, resource, resourceId, userId, 
            ipAddress, userAgent, metadata, createdAt)
```

---

## 🎯 Challenge Requirements Met

✅ **Authentication**
- JWT-based authentication with bcrypt
- Login/Register endpoints
- Token validation on every request

✅ **Authorization (RBAC)**
- 3 roles: Owner, Admin, Viewer
- 9 granular permissions
- Permission-based route guards
- Role hierarchy enforced

✅ **Task Management**
- Full CRUD operations
- Organization-level isolation
- Role-based data filtering

✅ **Audit Logging**
- Tracks all system actions
- Records user, IP, timestamp
- Accessible by Owner/Admin only

✅ **Security**
- Password hashing with bcrypt
- JWT expiration (24h)
- Permission validation
- Organization boundaries

---

## 🚀 Production Considerations

For production deployment, implement:

1. **Environment Variables**
   - Move JWT secret to `.env`
   - Configure database connection
   - Set proper CORS origins

2. **Security Enhancements**
   - Implement refresh tokens
   - Add rate limiting
   - Enable HTTPS only
   - Add CSRF protection

3. **Database**
   - Migrate to PostgreSQL/MySQL
   - Add connection pooling
   - Implement proper migrations

4. **Monitoring**
   - Add application logging
   - Implement error tracking
   - Monitor audit logs

---

## ⏱️ Development Time Log

**Total Development Time: 8 hours** (Timeboxed Challenge)

### Time Breakdown by Component

| Component                          | Time Spent | Notes                                      |
|-----------------------------------|------------|--------------------------------------------|
| **Project Setup & Configuration** | 1.0 hours  | NX monorepo, TypeORM, dependencies        |
| **Database Design & Entities**    | 1.5 hours  | 6 entities with relations, schema design  |
| **Authentication (JWT)**          | 1.0 hours  | Login/register, bcrypt, JWT strategy      |
| **RBAC System**                   | 1.5 hours  | Guards, decorators, permission logic      |
| **Task Management API**           | 1.0 hours  | CRUD operations, controllers, services    |
| **Audit Logging**                 | 0.5 hours  | Audit service, logging implementation     |
| **Database Seeding**              | 0.5 hours  | Seed data, test users, organizations      |
| **Testing & Debugging**           | 1.0 hours  | API testing, bug fixes, RBAC validation   |

**Total:** 8.0 hours

---

### Key Deliverables

✅ **Backend API**: Fully functional NestJS REST API with 8 endpoints  
✅ **Authentication**: JWT-based auth with bcrypt password hashing  
✅ **Authorization**: Complete RBAC with 3 roles and 9 permissions  
✅ **Audit System**: Comprehensive logging of all user actions  
✅ **Documentation**: Complete README with API docs and testing guide  
✅ **Testing**: Manual testing suite with curl commands provided  

---

## 👨‍💻 Author

**Farhan Tahmid**  
Software Engineer | AWS Certified

Built as part of a full-stack coding challenge demonstrating:
- NestJS backend architecture
- Role-Based Access Control
- JWT authentication
- Audit logging
- Monorepo management with NX

---

## 📄 License

This project is for demonstration purposes.

---

**Built with ❤️ using NestJS, Angular, and NX**