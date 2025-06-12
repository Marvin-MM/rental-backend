
import logger from '../../../config/logger.js';
import { verifyToken } from '../../../utils/helpers.js';
import prisma from '../../../config/database.js';

let io;

export const initializeSocket = (socketIo) => {
  io = socketIo;

  // Authentication middleware for socket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication error'));
      }

      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        include: {
          tenant: true,
          owner: true,
          manager: true,
        },
      });

      if (!user || !user.isActive) {
        return next(new Error('Authentication error'));
      }

      socket.userId = user.id;
      socket.userRole = user.role;
      socket.user = user;
      next();
    } catch (error) {
      logger.error('Socket authentication error:', error);
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected: ${socket.userId} (${socket.userRole})`);

    // Join user to their personal room
    socket.join(`user_${socket.userId}`);

    // Join role-based rooms
    socket.join(`role_${socket.userRole.toLowerCase()}`);

    // If tenant, join property room
    if (socket.user.tenant) {
      socket.join(`property_${socket.user.tenant.propertyId}`);
    }

    // If owner, join all owned properties
    if (socket.user.owner) {
      prisma.property.findMany({
        where: { ownerId: socket.user.owner.id },
        select: { id: true },
      }).then(properties => {
        properties.forEach(property => {
          socket.join(`property_${property.id}`);
        });
      });
    }

    // Handle joining chat rooms
    socket.on('join_chat', async (data) => {
      const { participantId } = data;
      
      try {
        // Verify user can chat with this participant
        const canChat = await verifychatPermission(socket.userId, participantId);
        if (canChat) {
          const roomId = getChatRoomId(socket.userId, participantId);
          socket.join(roomId);
          logger.info(`User ${socket.userId} joined chat room: ${roomId}`);
        }
      } catch (error) {
        logger.error('Error joining chat:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    // Handle sending messages
    socket.on('send_message', async (data) => {
      try {
        await handleSendMessage(socket, data);
      } catch (error) {
        logger.error('Error sending message:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Handle message read status
    socket.on('mark_read', async (data) => {
      try {
        await handleMarkRead(socket.userId, data.messageId);
        socket.emit('message_read', { messageId: data.messageId });
      } catch (error) {
        logger.error('Error marking message as read:', error);
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      logger.info(`User disconnected: ${socket.userId}`);
    });
  });

  logger.info('Socket.IO initialized successfully');
};

const verifyChatPermission = async (userId1, userId2) => {
  const user1 = await prisma.user.findUnique({
    where: { id: userId1 },
    include: { tenant: true, owner: true, manager: true },
  });

  const user2 = await prisma.user.findUnique({
    where: { id: userId2 },
    include: { tenant: true, owner: true, manager: true },
  });

  if (!user1 || !user2) return false;

  // Super admin can chat with anyone
  if (user1.role === 'SUPER_ADMIN' || user2.role === 'SUPER_ADMIN') {
    return true;
  }

  // Tenant can chat with their property owner/manager
  if (user1.role === 'TENANT' && user1.tenant) {
    const property = await prisma.property.findUnique({
      where: { id: user1.tenant.propertyId },
      include: { owner: true },
    });

    if (property && property.owner.userId === userId2) {
      return true;
    }

    // Check if user2 is a manager of the property owner
    if (user2.role === 'MANAGER' && user2.manager) {
      return property && property.ownerId === user2.manager.ownerId;
    }
  }

  // Owner can chat with their tenants
  if (user1.role === 'OWNER' && user1.owner) {
    if (user2.role === 'TENANT' && user2.tenant) {
      const property = await prisma.property.findUnique({
        where: { id: user2.tenant.propertyId },
      });
      return property && property.ownerId === user1.owner.id;
    }
  }

  return false;
};

const getChatRoomId = (userId1, userId2) => {
  const sortedIds = [userId1, userId2].sort();
  return `chat_${sortedIds[0]}_${sortedIds[1]}`;
};

const handleSendMessage = async (socket, data) => {
  const { receiverId, content, type = 'TEXT' } = data;

  // Verify permission
  const canChat = await verifychatPermission(socket.userId, receiverId);
  if (!canChat) {
    socket.emit('error', { message: 'You are not authorized to send messages to this user' });
    return;
  }

  // Save message to database
  const message = await prisma.message.create({
    data: {
      senderId: socket.userId,
      receiverId,
      content,
      type,
    },
    include: {
      sender: {
        select: {
          id: true,
          email: true,
          role: true,
        },
      },
    },
  });

  // Send to chat room
  const roomId = getChatRoomId(socket.userId, receiverId);
  io.to(roomId).emit('new_message', {
    id: message.id,
    content: message.content,
    type: message.type,
    createdAt: message.createdAt,
    sender: message.sender,
    isRead: false,
  });

  // Send notification to receiver if not online
  const receiverSockets = await io.in(`user_${receiverId}`).fetchSockets();
  if (receiverSockets.length === 0) {
    // User is offline, send push notification
    await sendPushNotification(receiverId, {
      title: 'New Message',
      body: `You have a new message from ${message.sender.email}`,
      data: {
        type: 'message',
        senderId: socket.userId,
        messageId: message.id,
      },
    });
  }

  logger.info(`Message sent from ${socket.userId} to ${receiverId}`);
};

const handleMarkRead = async (userId, messageId) => {
  await prisma.message.update({
    where: { 
      id: messageId,
      receiverId: userId,
    },
    data: { isRead: true },
  });
};

export const sendNotificationToUser = (userId, notification) => {
  if (io) {
    io.to(`user_${userId}`).emit('notification', notification);
  }
};

export const sendNotificationToRole = (role, notification) => {
  if (io) {
    io.to(`role_${role.toLowerCase()}`).emit('notification', notification);
  }
};

export const sendNotificationToProperty = (propertyId, notification) => {
  if (io) {
    io.to(`property_${propertyId}`).emit('notification', notification);
  }
};

export const sendPushNotification = async (userId, notificationData) => {
  try {
    // Save notification to database
    await prisma.notification.create({
      data: {
        recipientId: userId,
        title: notificationData.title,
        message: notificationData.body,
        type: 'PUSH',
        metadata: notificationData.data || {},
      },
    });

    // Send real-time notification
    sendNotificationToUser(userId, notificationData);

    logger.info(`Push notification sent to user: ${userId}`);
  } catch (error) {
    logger.error('Error sending push notification:', error);
    throw error;
  }
};
