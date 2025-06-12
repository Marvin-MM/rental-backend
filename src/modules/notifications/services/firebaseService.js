
import admin from 'firebase-admin';
import logger from '../../../config/logger.js';

// Initialize Firebase Admin SDK
let firebaseApp;

try {
  if (!admin.apps.length) {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
  } else {
    firebaseApp = admin.app();
  }
} catch (error) {
  logger.error('Failed to initialize Firebase:', error);
}

export const sendPushNotification = async (token, title, body, data = {}) => {
  try {
    if (!firebaseApp) {
      logger.warn('Firebase not initialized, skipping push notification');
      return null;
    }

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      token,
    };

    const response = await admin.messaging().send(message);
    logger.info(`Push notification sent successfully: ${response}`);
    return response;
  } catch (error) {
    logger.error('Error sending push notification:', error);
    throw error;
  }
};

export const sendMultiplePushNotifications = async (tokens, title, body, data = {}) => {
  try {
    if (!firebaseApp) {
      logger.warn('Firebase not initialized, skipping push notifications');
      return null;
    }

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      tokens,
    };

    const response = await admin.messaging().sendMulticast(message);
    logger.info(`Batch push notifications sent: ${response.successCount} successful, ${response.failureCount} failed`);
    
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
          logger.error(`Failed to send to token ${tokens[idx]}:`, resp.error);
        }
      });
    }

    return response;
  } catch (error) {
    logger.error('Error sending batch push notifications:', error);
    throw error;
  }
};

export const subscribeToTopic = async (tokens, topic) => {
  try {
    if (!firebaseApp) {
      logger.warn('Firebase not initialized, skipping topic subscription');
      return null;
    }

    const response = await admin.messaging().subscribeToTopic(tokens, topic);
    logger.info(`Subscribed ${response.successCount} tokens to topic ${topic}`);
    return response;
  } catch (error) {
    logger.error('Error subscribing to topic:', error);
    throw error;
  }
};

export const unsubscribeFromTopic = async (tokens, topic) => {
  try {
    if (!firebaseApp) {
      logger.warn('Firebase not initialized, skipping topic unsubscription');
      return null;
    }

    const response = await admin.messaging().unsubscribeFromTopic(tokens, topic);
    logger.info(`Unsubscribed ${response.successCount} tokens from topic ${topic}`);
    return response;
  } catch (error) {
    logger.error('Error unsubscribing from topic:', error);
    throw error;
  }
};

export const sendTopicNotification = async (topic, title, body, data = {}) => {
  try {
    if (!firebaseApp) {
      logger.warn('Firebase not initialized, skipping topic notification');
      return null;
    }

    const message = {
      notification: {
        title,
        body,
      },
      data: {
        ...data,
        timestamp: new Date().toISOString(),
      },
      topic,
    };

    const response = await admin.messaging().send(message);
    logger.info(`Topic notification sent to ${topic}: ${response}`);
    return response;
  } catch (error) {
    logger.error('Error sending topic notification:', error);
    throw error;
  }
};
