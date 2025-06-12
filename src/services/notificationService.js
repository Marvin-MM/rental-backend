
import { sendEmail } from '../modules/notifications/services/emailService.js';
import { sendPushNotification } from '../modules/notifications/services/firebaseService.js';
import { sendNotificationToUser } from '../modules/notifications/services/socketService.js';
import prisma from '../config/database.js';
import logger from '../config/logger.js';

export const sendMultiChannelNotification = async (userId, notification) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        owner: true,
        manager: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    // Save notification to database
    const savedNotification = await prisma.notification.create({
      data: {
        title: notification.title,
        body: notification.body,
        type: notification.type || 'general',
        recipientId: userId,
        data: notification.data || {}
      }
    });

    // Send real-time notification via WebSocket
    await sendNotificationToUser(userId, notification);

    // Send email notification
    if (user.email) {
      await sendEmail({
        to: user.email,
        subject: notification.title,
        text: notification.body,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">${notification.title}</h2>
            <p style="color: #666; line-height: 1.6;">${notification.body}</p>
            <div style="margin-top: 20px; padding: 10px; background-color: #f5f5f5; border-radius: 5px;">
              <small style="color: #888;">This is an automated notification from Rental Management System</small>
            </div>
          </div>
        `
      });
    }

    // Send push notification if FCM token exists
    const fcmToken = user.fcmToken;
    if (fcmToken) {
      await sendPushNotification(fcmToken, notification);
    }

    logger.info(`Multi-channel notification sent to user ${userId}: ${notification.title}`);
    return savedNotification;

  } catch (error) {
    logger.error('Error sending multi-channel notification:', error);
    throw error;
  }
};

export const sendBulkNotification = async (userIds, notification) => {
  const results = [];
  
  for (const userId of userIds) {
    try {
      const result = await sendMultiChannelNotification(userId, notification);
      results.push({ userId, success: true, notificationId: result.id });
    } catch (error) {
      results.push({ userId, success: false, error: error.message });
    }
  }

  return results;
};

export const sendRoleBasedNotification = async (roles, notification) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        role: { in: roles }
      },
      select: { id: true }
    });

    const userIds = users.map(user => user.id);
    return await sendBulkNotification(userIds, notification);

  } catch (error) {
    logger.error('Error sending role-based notification:', error);
    throw error;
  }
};
