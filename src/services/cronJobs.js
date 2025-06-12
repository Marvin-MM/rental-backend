
import cron from 'node-cron';
import prisma from '../config/database.js';
import logger from '../config/logger.js';
import { sendPaymentReminderEmail } from '../modules/notifications/services/emailService.js';

// Run every day at 9 AM to check for overdue payments
export const checkOverduePayments = () => {
  cron.schedule('0 9 * * *', async () => {
    try {
      logger.info('Running overdue payments check...');

      const overduePayments = await prisma.payment.updateMany({
        where: {
          status: 'PENDING',
          dueDate: {
            lt: new Date(),
          },
        },
        data: {
          status: 'OVERDUE',
        },
      });

      logger.info(`Updated ${overduePayments.count} payments to overdue status`);

      // Send reminder emails for overdue payments
      const overduePaymentsWithDetails = await prisma.payment.findMany({
        where: {
          status: 'OVERDUE',
          dueDate: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000), // Updated today
          },
        },
        include: {
          tenant: {
            include: {
              user: true,
            },
          },
          lease: {
            include: {
              property: true,
            },
          },
        },
      });

      for (const payment of overduePaymentsWithDetails) {
        try {
          await sendPaymentReminderEmail(
            payment.tenant.user.email,
            payment.tenant.firstName,
            payment.amount,
            payment.dueDate,
            payment.lease.property.name
          );
        } catch (error) {
          logger.error(`Failed to send reminder email to ${payment.tenant.user.email}:`, error);
        }
      }

      logger.info(`Sent reminder emails for ${overduePaymentsWithDetails.length} overdue payments`);
    } catch (error) {
      logger.error('Error checking overdue payments:', error);
    }
  });
};

// Run every day at 8 AM to send payment reminders (3 days before due)
export const sendPaymentReminders = () => {
  cron.schedule('0 8 * * *', async () => {
    try {
      logger.info('Running payment reminders check...');

      const threeDaysFromNow = new Date();
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const upcomingPayments = await prisma.payment.findMany({
        where: {
          status: 'PENDING',
          dueDate: {
            gte: new Date(),
            lte: threeDaysFromNow,
          },
        },
        include: {
          tenant: {
            include: {
              user: true,
            },
          },
          lease: {
            include: {
              property: true,
            },
          },
        },
      });

      for (const payment of upcomingPayments) {
        try {
          await sendPaymentReminderEmail(
            payment.tenant.user.email,
            payment.tenant.firstName,
            payment.amount,
            payment.dueDate,
            payment.lease.property.name
          );
        } catch (error) {
          logger.error(`Failed to send payment reminder to ${payment.tenant.user.email}:`, error);
        }
      }

      logger.info(`Sent payment reminders for ${upcomingPayments.length} upcoming payments`);
    } catch (error) {
      logger.error('Error sending payment reminders:', error);
    }
  });
};

// Run monthly on the 1st at 10 AM to generate monthly reports
export const generateMonthlyReports = () => {
  cron.schedule('0 10 1 * *', async () => {
    try {
      logger.info('Generating monthly reports...');

      const lastMonth = new Date();
      lastMonth.setMonth(lastMonth.getMonth() - 1);

      const startOfMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
      const endOfMonth = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);

      // Generate analytics for each owner
      const owners = await prisma.owner.findMany({
        include: {
          properties: {
            include: {
              payments: {
                where: {
                  paidDate: {
                    gte: startOfMonth,
                    lte: endOfMonth,
                  },
                },
              },
              leases: {
                where: {
                  status: 'ACTIVE',
                },
              },
            },
          },
        },
      });

      for (const owner of owners) {
        const totalRevenue = owner.properties.reduce((sum, property) => {
          return sum + property.payments.reduce((paymentSum, payment) => paymentSum + payment.amount, 0);
        }, 0);

        const totalProperties = owner.properties.length;
        const occupiedProperties = owner.properties.filter(p => p.leases.length > 0).length;
        const occupancyRate = totalProperties > 0 ? (occupiedProperties / totalProperties) * 100 : 0;

        // Store monthly analytics
        await prisma.analytics.create({
          data: {
            ownerId: owner.id,
            period: 'MONTHLY',
            startDate: startOfMonth,
            endDate: endOfMonth,
            totalRevenue,
            totalProperties,
            occupiedProperties,
            occupancyRate,
            data: {
              properties: owner.properties.map(p => ({
                id: p.id,
                name: p.name,
                revenue: p.payments.reduce((sum, payment) => sum + payment.amount, 0),
                occupancy: p.leases.length > 0,
              })),
            },
          },
        });
      }

      logger.info(`Generated monthly reports for ${owners.length} owners`);
    } catch (error) {
      logger.error('Error generating monthly reports:', error);
    }
  });
};

// Run weekly on Sundays at 11 PM for cleanup tasks
export const cleanupTasks = () => {
  cron.schedule('0 23 * * 0', async () => {
    try {
      logger.info('Running cleanup tasks...');

      // Clean up old login attempts (keep only last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const deletedAttempts = await prisma.loginAttempt.deleteMany({
        where: {
          createdAt: {
            lt: thirtyDaysAgo,
          },
        },
      });

      // Clean up old notifications (keep only last 90 days)
      const ninetyDaysAgo = new Date();
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

      const deletedNotifications = await prisma.notification.deleteMany({
        where: {
          createdAt: {
            lt: ninetyDaysAgo,
          },
          isRead: true,
        },
      });

      logger.info(`Cleanup completed: ${deletedAttempts.count} login attempts, ${deletedNotifications.count} notifications deleted`);
    } catch (error) {
      logger.error('Error running cleanup tasks:', error);
    }
  });
};

// Start all cron jobs
export const startCronJobs = () => {
  logger.info('Starting cron jobs...');
  checkOverduePayments();
  sendPaymentReminders();
  generateMonthlyReports();
  cleanupTasks();
  logger.info('All cron jobs started successfully');
};
