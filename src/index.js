import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';
import swaggerUi from 'swagger-ui-express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';

// Import configurations
import logger from './config/logger.js';
import swaggerSpecs from './config/swagger.js';
import prisma from './config/database.js';

// Import middleware
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { apiLimiter, speedLimiter } from './middleware/rateLimiter.js';
import { securityHeaders, preventParameterPollution, sanitizeInput } from './middleware/security.js';

// Import routes
import authRoutes from './modules/auth/routes/authRoutes.js';
import propertyRoutes from './modules/properties/routes/propertyRoutes.js';
import tenantRoutes from './modules/tenants/routes/tenantRoutes.js';
import ownerRoutes from './modules/owners/routes/ownerRoutes.js';
import managerRoutes from './modules/managers/routes/managerRoutes.js';
import leaseRoutes from './modules/leases/routes/leaseRoutes.js';
import paymentRoutes from './modules/payments/routes/paymentRoutes.js';
import complaintRoutes from './modules/complaints/routes/complaintRoutes.js';
import notificationRoutes from './modules/notifications/routes/notificationRoutes.js';
// import analyticsRoutes from './modules/analytics/routes/analyticsRoutes.js';
import reportRoutes from './modules/reports/routes/reportRoutes.js';
import maintenanceRoutes from './modules/maintenance/routes/maintenanceRoutes.js';
import adminRoutes from './modules/admin/routes/adminRoutes.js';
import calendarRoutes from './modules/calendar/routes/calendarRoutes.js';

// Import socket handlers
import { initializeSocket } from './modules/notifications/services/socketService.js';
import { startCronJobs } from './services/cronJobs.js';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

// Initialize Socket.IO
initializeSocket(io);

// Security middleware
app.use(securityHeaders);
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(preventParameterPollution);
app.use(sanitizeInput);

// General middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan('combined', { stream: { write: message => logger.info(message.trim()) } }));

// Rate limiting
app.use(apiLimiter);
app.use(speedLimiter);

// Input sanitization
app.use(sanitizeInput);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV,
  });
});

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: "Rental Management API Documentation"
}));

// API Routes
const API_VERSION = '/api/v1';

app.use(`${API_VERSION}/auth`, authRoutes);
app.use(`${API_VERSION}/properties`, propertyRoutes);
app.use(`${API_VERSION}/tenants`, tenantRoutes);
app.use(`${API_VERSION}/owners`, ownerRoutes);
app.use(`${API_VERSION}/managers`, managerRoutes);
app.use(`${API_VERSION}/leases`, leaseRoutes);
app.use(`${API_VERSION}/payments`, paymentRoutes);
app.use(`${API_VERSION}/complaints`, complaintRoutes);
app.use(`${API_VERSION}/notifications`, notificationRoutes);
// app.use(`${API_VERSION}/analytics`, analyticsRoutes);
app.use(`${API_VERSION}/reports`, reportRoutes);
app.use(`${API_VERSION}/maintenance`, maintenanceRoutes);
app.use(`${API_VERSION}/admin`, adminRoutes);
app.use(`${API_VERSION}/calendar`, calendarRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`Received ${signal}. Shutting down gracefully...`);

  server.close(async () => {
    logger.info('HTTP server closed.');

    // Close database connection
    await prisma.$disconnect();
    logger.info('Database connection closed.');

    process.exit(0);
  });

  // Force close after 30 seconds
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start cron jobs
startCronJobs();

// Start server
server.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
  logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
});

export default app;