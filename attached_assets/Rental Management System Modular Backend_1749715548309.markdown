# Production-Ready Rental Management System Backend (Modular Monolith)

## Objective
Develop a production-ready backend for a rental management system as a single, modular Node.js application. The system will manage properties, tenants, leases, payments, analytics, messaging, and notifications, with distinct user roles (super-admin, owner, manager, tenant). The backend must use Node.js with Express.js(consider using ES modules not commonjs), Prisma as the ORM, and a PostgreSQL database. The application must be Dockerized for scalability and deployment, support tenant analytics and calendars, handle push notifications, and ensure secure, scalable, and robust functionality. The modular structure organizes code into logical components for maintainability, avoiding the complexity of microservices.


## Requirements

### General Requirements
- **Technology Stack, use modern libraries/tools (but not limited to only these)**:
  - Backend: Node.js (Express.js, JavaScript, no TypeScript).
  - ORM: Prisma with a PostgreSQL database.
  - Authentication: JWT for secure access, bcrypt for password hashing.
  - Communication: WebSocket (e.g., Socket.IO) for real-time chat, HTTP/REST for API endpoints.
  - Notifications: Email (Nodemailer), in-portal, and push notifications (e.g., Firebase Cloud Messaging for tenants).
  - PDF Generation: PDFKit for tenant receipt generation, stored in cloud storage (e.g., AWS S3).
  - Scheduling: Node-cron for automated tasks (e.g., reminders).
  - Deployment: Dockerized with Docker Compose for local development and Kubernetes compatibility for production.
- **Database**: Single PostgreSQL database with a unified schema for all modules.
- **Modularity**: Organize the application into modules (e.g., auth, properties, tenants, payments, notifications, owners) to separate concerns while keeping all logic in one codebase.
- **Scalability**: Design the application to be stateless, support horizontal scaling, and use environment variables for configuration.
- **Security**:
  - JWT-based authentication for all protected endpoints.
  - Role-based access control (RBAC) for super-admin, owner, manager, and tenant roles.
  - Secure password storage and sensitive data handling (e.g., HTTPS, encrypted storage).
  - Input validation and sanitization to prevent injection attacks.
- **Error Handling**: Comprehensive error handling with meaningful error codes and messages, logged centrally (e.g., Winston).
- **Logging and Monitoring**: Implement logging (e.g., Winston or Morgan) and expose a health check endpoint (`/health`).

### Functional Requirements
1. **User Roles and Permissions**:
   - **Super-Admin**: Oversees the platform, creates owners, and monitors all activities.
   - **Owner**: Manages properties, tenants, leases, payments, and analytics; creates managers with limited permissions.
   - **Manager**: Assists owners with restricted actions (e.g., view analytics, approve payments, no property deletion).
   - **Tenant**: Views lease details, tracks payments, receives notifications, and communicates with owners (including anonymous complaints).
   - Automatic tenant user account creation upon tenant registration with a default password (e.g., randomly generated, sent via email).

2. **Tenant Features**:
   - **Analytics**: View payment history, overdue amounts, and lease status.
   - **Calendar**: Track due dates, lease start/end dates, and payment schedules.
   - **Notifications**: Receive reminders for due payments/leases (email, in-portal, push notifications).
   - **Payments**: Initiate payments (e.g., via Stripe) and download PDF receipts.
   - **Communication**: Chat with owners and send anonymous complaints.
   - **Overdue Tracking**: View unpaid months and receive automated reminders.

3. **Owner Features**:
   - Create/edit/delete properties, tenants, and leases.
   - Approve cash payments manually.
   - View analytics (e.g., revenue, unpaid rents, tenant occupancy rates).
   - Send alerts to all tenants or specific tenants.
   - Assign managers with limited permissions.

4. **Manager Features**:
   - View tenant and property details (read-only unless permitted).
   - Approve payments or handle tenant communications if authorized.
   - Restricted from critical actions (e.g., deleting properties or leases).

5. **Super-Admin Features**:
   - Create owners and monitor system-wide analytics.
   - Full access to all data and functionality.

### Modular Structure
The backend is a single Node.js application organized into modules, each handling a specific domain (similar to the previous microservices). Each module encapsulates its routes, controllers, services, and Prisma interactions, sharing the same PostgreSQL database and Prisma Client.

#### Modules
1. **Auth Module**:
   - Handles user authentication, authorization, and role management.
   - Registers/logs in users (super-admin, owner, manager, tenant).
   - Automatically creates tenant user accounts with default passwords during tenant registration (triggered by Tenants Module).
   - Generates and validates JWT tokens.
   - Manages roles and permissions (RBAC).
   - Sends registration confirmation emails (via Notifications Module).
   - Endpoints (examples):
     - `POST /auth/register`: Register a user.
     - `POST /auth/login`: Authenticate and return JWT.
     - `POST /auth/tenant-user`: Create tenant user account (internal call).
     - `GET /auth/roles/:userId`: Get user roles and permissions.

2. **Properties Module**:
   - Manages properties and leases.
   - Creates/edits/deletes properties (owner only).
   - Creates/edits leases tied to properties and tenants.
   - Tracks lease start/end dates and 30-day tenant monitoring from lease creation.
   - Provides property details with associated tenant lists.
   - Triggers lease-related reminders (via Notifications Module).
   - Endpoints (examples):
     - `POST /properties`: Create a property.
     - `GET /properties/:id`: Get property details with tenant list.
     - `POST /leases`: Create a lease.
     - `GET /leases/tenant/:tenantId`: Get tenant’s lease details.

3. **Tenants Module**:
   - Manages tenant profiles and tenant-specific features.
   - Creates/edits tenant profiles (owner only).
   - Triggers automatic user account creation in Auth Module.
   - Provides tenant analytics (payment history, overdue amounts, lease status).
   - Generates calendar data for due dates, lease start/end, and payment schedules.
   - Handles anonymous complaints.
   - Triggers tenant-related reminders and complaints (via Notifications Module).
   - Endpoints (examples):
     - `POST /tenants`: Create a tenant (triggers user account creation).
     - `GET /tenants/:id`: Get tenant details.
     - `GET /tenants/:id/analytics`: Get tenant analytics.
     - `GET /tenants/:id/calendar`: Get tenant’s calendar data.
     - `POST /tenants/complaint`: Submit anonymous complaint.

4. **Payments Module**:
   - Manages payments, receipt generation, and analytics.
   - Handles tenant payments (online via Stripe, manual cash approval by owners/managers).
   - Generates and stores PDF receipts (using PDFKit, stored in AWS S3 or cloudinary).
   - Provides analytics for owners (revenue, unpaid rents, occupancy) and tenants (payment history, overdue amounts).
   - Triggers payment confirmations and reminders (via Notifications Module).
   - Endpoints (examples):
     - `POST /payments`: Initiate a payment.
     - `POST /payments/approve`: Approve cash payment.
     - `GET /payments/receipt/:id`: Download receipt PDF.
     - `GET /reports/owner/:ownerId`: Get owner analytics.
     - `GET /reports/tenant/:tenantId`: Get tenant analytics.

5. **Notifications Module**:
   - Centralizes all communication and notifications (email, in-portal, push).
   - Manages tenant-owner chat (real-time via WebSocket).
   - Handles owner alerts to all/specific tenants (email, in-portal, push via Firebase Cloud Messaging).
   - Sends automated reminders for lease/payment due dates (scheduled via node-cron).
   - Processes registration confirmations, payment confirmations, and anonymous complaints.
   - Endpoints (examples):
     - `POST /messages`: Send a chat message.
     - `GET /messages/:tenantId`: Get chat history.
     - `POST /notifications/alert`: Send alert to tenants.
     - `POST /notifications/reminder`: Send automated reminder.
     - `POST /notifications/push`: Send push notification.

6. **Owners Module**:
   - Manages owner and manager actions and permissions.
   - Allows super-admin to create owners.
   - Allows owners to create managers with limited permissions (e.g., no property deletion).
   - Provides owner analytics (system-wide or per-property).
   - Restricts manager actions based on permissions.
   - Endpoints (examples):
     - `POST /owners`: Create an owner (super-admin only).
     - `POST /managers`: Create a manager (owner only).
     - `GET /owners/:id/analytics`: Get owner analytics.
     - `GET /managers/:id/permissions`: Get manager permissions.

### Folder Structure
The application follows a modular folder structure to organize code by domain, with a single Prisma schema for the entire database.

```
/rental-management-backend
├── /src
│   ├── /modules
│   │   ├── /auth
│   │   │   ├── /controllers    # Auth route handlers
│   │   │   ├── /routes         # Auth API routes
│   │   │   └── /services       # Auth business logic
│   │   ├── /properties
│   │   │   ├── /controllers    # Properties and leases route handlers
│   │   │   ├── /routes         # Properties and leases API routes
│   │   │   └── /services       # Properties and leases business logic
│   │   ├── /tenants
│   │   │   ├── /controllers    # Tenants route handlers
│   │   │   ├── /routes         # Tenants API routes
│   │   │   └── /services       # Tenants business logic (analytics, calendar)
│   │   ├── /payments
│   │   │   ├── /controllers    # Payments and reports route handlers
│   │   │   ├── /routes         # Payments and reports API routes
│   │   │   └── /services       # Payments and reports business logic
│   │   ├── /notifications
│   │   │   ├── /controllers    # Notifications and messages route handlers
│   │   │   ├── /routes         # Notifications and messages API routes
│   │   │   └── /services       # Notifications and messages business logic
│   │   ├── /owners
│   │   │   ├── /controllers    # Owners and managers route handlers
│   │   │   ├── /routes         # Owners and managers API routes
│   │   │   └── /services       # Owners and managers business logic
│   ├── /middleware             # Authentication, validation, error handling
│   ├── /utils                  # Shared utilities (e.g., logging, PDF generation etc)
│   ├── /config                 # Database, environment config
│   └── index.js                # Application entry point (sets up Express, routes)
├── Dockerfile                  # Docker configuration
├── prisma
│   └── schema.prisma           # Unified Prisma schema for all models
├── package.json                # Dependencies and scripts
├── .env                        # Environment variables (e.g., DATABASE_URL)
├── .gitignore                  # Git ignore file
└── README.md                   # Project documentation
```

### Database Schema (PostgreSQL)(not limited to this, if there is anything to add in to make this more robust, then why not)
- **User**: id, email, password (hashed), role (super-admin/owner/manager/tenant), createdAt.
- **Property**: id, ownerId, name, description, address, createdAt.
- **Tenant**: id, userId, propertyId, contactInfo, createdAt.
- **Lease**: id, propertyId, tenantId, startDate, endDate, rentAmount, status.
- **Payment**: id, tenantId, leaseId, amount, status (pending/approved), date, paymentMethod.
- **Receipt**: id, paymentId, pdfUrl, createdAt.
- **Message**: id, senderId, receiverId, content, timestamp.
- **Notification**: id, recipientId, message, type (alert/reminder/push), status, createdAt.
- **Complaint**: id, propertyId, message, anonymous (boolean), createdAt.
- **Owner**: id, userId, createdAt.
- **Manager**: id, userId, ownerId, permissions (JSON), createdAt.

### Additional Requirements
- **Tenant Account Creation**:
  - When a tenant is created (Tenants Module), automatically trigger user account creation in the Auth Module with a default password (randomly generated, e.g., UUID-based).
  - Send a welcome email with the default password via the Notifications Module.
- **Tenant Analytics and Calendar**:
  - Analytics include payment history, overdue amounts, and lease status (Payments Module).
  - Calendar data includes due dates, lease start/end, and payment schedules (Tenants Module).
  - Expose endpoints for tenants to fetch analytics and calendar data.
- **Push Notifications**:
  - Owners can send push notifications to tenants (all or specific) via the Notifications Module.
  - Use Firebase Cloud Messaging (FCM) for push notifications.
  - Store notification metadata in the database for tracking.
- **Dockerization**:
  - Provide a `Dockerfile` for the entire application.
  - Use Docker Compose for local development, defining the application and PostgreSQL services:
    ```yaml
    services:
      app:
        build: .
        environment:
          DATABASE_URL: postgresql://user:password@postgres:5432/rental_db
        ports:
          - "3000:3000"
        depends_on:
          - postgres
      postgres:
        image: postgres:latest
        environment:
          POSTGRES_USER: user
          POSTGRES_PASSWORD: password
          POSTGRES_DB: rental_db
        ports:
          - "5432:5432"
    ```
  - Ensure the application is stateless and uses environment variables for configuration (e.g., `DATABASE_URL`, Stripe keys).
- **Module Communication**:
  - Modules interact directly via function calls within the same codebase (e.g., Tenants Module calls Auth Module for user creation).
  - All notifications (confirmations, alerts, reminders) are handled by the Notifications Module to centralize communication logic.
  - Use dependency injection or a service locator pattern to manage module dependencies.
- **Scalability**:
  - Keep the application stateless to support horizontal scaling.
  - Use Prisma’s connection pooling for PostgreSQL.
  - Implement caching (e.g., Redis) for frequently accessed data (e.g., analytics, calendar data).
- **Production Readiness**:
  - Implement a health check endpoint (`/health`) for monitoring.
  - Use environment variables for sensitive configurations (e.g., database credentials, API keys).
  - Set up logging (e.g., Winston) for debugging and auditing.
  - Ensure graceful error handling and recovery from failures.

### Constraints
- Focus strictly on the backend; no frontend implementation.
- Use JavaScript (no TypeScript).
- Implement as a single, modular Node.js application, not microservices.
- Use a single PostgreSQL database with a unified Prisma schema (`prisma/schema.prisma`).
- All notifications (confirmations, alerts, reminders) should be handled by the Notifications Module unless if you have a better way to handle it.
- The `/src/models` folder is optional; use it only if complex model-specific logic (e.g., analytics calculations, calendar formatting) is needed beyond Prisma Client capabilities. Otherwise, handle model interactions in `/src/modules/*/services`.

### Deliverables
- Fully implemented modular Node.js application with the specified folder structure.
- Single `prisma/schema.prisma` file defining all database models.
- Dockerfile and Docker Compose configuration for the application and PostgreSQL.
- README documenting setup, environment variables, and usage.
