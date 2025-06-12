
import redis from 'redis';
import logger from './logger.js';

let redisClient = null;

export const initializeRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 60000,
        lazyConnect: true,
      },
    });

    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });

    redisClient.on('connect', () => {
      logger.info('Redis client connected');
    });

    redisClient.on('ready', () => {
      logger.info('Redis client ready');
    });

    redisClient.on('end', () => {
      logger.info('Redis client disconnected');
    });

    await redisClient.connect();
    return redisClient;
  } catch (error) {
    logger.error('Failed to initialize Redis:', error);
    // Don't throw error to allow app to work without Redis
    return null;
  }
};

export const getRedisClient = () => {
  return redisClient;
};

export const closeRedis = async () => {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
};

// Cache helper functions
export const setCache = async (key, value, expiration = 3600) => {
  if (!redisClient) return false;
  
  try {
    await redisClient.setEx(key, expiration, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error('Redis set error:', error);
    return false;
  }
};

export const getCache = async (key) => {
  if (!redisClient) return null;
  
  try {
    const value = await redisClient.get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    logger.error('Redis get error:', error);
    return null;
  }
};

export const deleteCache = async (key) => {
  if (!redisClient) return false;
  
  try {
    await redisClient.del(key);
    return true;
  } catch (error) {
    logger.error('Redis delete error:', error);
    return false;
  }
};

export const flushCache = async () => {
  if (!redisClient) return false;
  
  try {
    await redisClient.flushAll();
    return true;
  } catch (error) {
    logger.error('Redis flush error:', error);
    return false;
  }
};

export default {
  initializeRedis,
  getRedisClient,
  closeRedis,
  setCache,
  getCache,
  deleteCache,
  flushCache,
};
