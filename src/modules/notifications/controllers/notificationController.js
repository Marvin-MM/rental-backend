
import prisma from '../../../config/database.js';
import logger from '../../../config/logger.js';
import { sendNotificationToUser, sendPushNotification } from '../services/socketService.js';
import { sendEmail } from '../services/emailService.js';

export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { page = 1, limit = 20, unreadOnly = false } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      recipientId: userId,
      ...(unreadOnly === 'true' && { isRead: false }),
    };

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notification.count({ where }),
    ]);

    res.json({
      notifications,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    logger.error('Error fetching notifications:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch notifications',
    });
  }
};

export const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        recipientId: userId,
      },
    });

    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found',
        message: 'Notification with this ID does not exist',
      });
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({
      message: 'Notification marked as read',
    });
  } catch (error) {
    logger.error('Error marking notification as read:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to mark notification as read',
    });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    await prisma.notification.updateMany({
      where: {
        recipientId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({
      message: 'All notifications marked as read',
    });
  } catch (error) {
    logger.error('Error marking all notifications as read:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to mark all notifications as read',
    });
  }
};

export const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const notification = await prisma.notification.findFirst({
      where: {
        id,
        recipientId: userId,
      },
    });

    if (!notification) {
      return res.status(404).json({
        error: 'Notification not found',
        message: 'Notification with this ID does not exist',
      });
    }

    await prisma.notification.delete({
      where: { id },
    });

    res.json({
      message: 'Notification deleted successfully',
    });
  } catch (error) {
    logger.error('Error deleting notification:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete notification',
    });
  }
};

export const sendBulkNotification = async (req, res) => {
  try {
    const { title, message, recipients, type = 'IN_APP' } = req.body;

    if (!title || !message || !recipients || !Array.isArray(recipients)) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Title, message, and recipients array are required',
      });
    }

    const notifications = recipients.map(recipientId => ({
      recipientId,
      title,
      message,
      type,
      senderId: req.user.userId,
    }));

    await prisma.notification.createMany({
      data: notifications,
    });

    // Send real-time notifications
    for (const recipientId of recipients) {
      sendNotificationToUser(recipientId, {
        title,
        body: message,
        type,
      });

      // Send email if type includes EMAIL
      if (type.includes('EMAIL')) {
        const user = await prisma.user.findUnique({
          where: { id: recipientId },
          select: { email: true },
        });

        if (user) {
          await sendEmail({
            to: user.email,
            subject: title,
            text: message,
          });
        }
      }
    }

    logger.info(`Bulk notification sent to ${recipients.length} users by ${req.user.email}`);

    res.json({
      message: 'Bulk notification sent successfully',
      recipientCount: recipients.length,
    });
  } catch (error) {
    logger.error('Error sending bulk notification:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to send bulk notification',
    });
  }
};

export const getNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.userId;

    let settings = await prisma.notificationSettings.findUnique({
      where: { userId },
    });

    if (!settings) {
      // Create default settings
      settings = await prisma.notificationSettings.create({
        data: {
          userId,
          emailNotifications: true,
          pushNotifications: true,
          smsNotifications: false,
        },
      });
    }

    res.json(settings);
  } catch (error) {
    logger.error('Error fetching notification settings:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch notification settings',
    });
  }
};

export const updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { emailNotifications, pushNotifications, smsNotifications } = req.body;

    const settings = await prisma.notificationSettings.upsert({
      where: { userId },
      update: {
        emailNotifications,
        pushNotifications,
        smsNotifications,
      },
      create: {
        userId,
        emailNotifications: emailNotifications ?? true,
        pushNotifications: pushNotifications ?? true,
        smsNotifications: smsNotifications ?? false,
      },
    });

    res.json({
      message: 'Notification settings updated successfully',
      settings,
    });
  } catch (error) {
    logger.error('Error updating notification settings:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update notification settings',
    });
  }
};
