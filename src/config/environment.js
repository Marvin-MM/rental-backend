import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

// Environment validation schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('5000'),

  // Database
  DATABASE_URL: z.string().min(1, 'Database URL is required'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT secret must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.string().transform(Number).optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: z.string().optional(),
  CLOUDINARY_API_KEY: z.string().optional(),
  CLOUDINARY_API_SECRET: z.string().optional(),

  // Firebase
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),

  // Redis
  REDIS_URL: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('900000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Frontend
  FRONTEND_URL: z.string().default('http://localhost:3000'),

  // Feature Flags
  ENABLE_SWAGGER: z.string().transform(Boolean).default('true'),
  ENABLE_RATE_LIMITING: z.string().transform(Boolean).default('true'),
  ENABLE_CORS: z.string().transform(Boolean).default('true'),
});

// Validate environment variables
let env;
try {
  env = envSchema.parse(process.env);
} catch (error) {
  console.error('❌ Invalid environment variables:');
  console.error(error.errors);
  process.exit(1);
}

// Environment configuration object
export const config = {
  env: env.NODE_ENV,
  port: env.PORT,
  isDevelopment: env.NODE_ENV === 'development',
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',

  database: {
    url: env.DATABASE_URL,
  },

  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
  },

  email: {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    user: env.SMTP_USER,
    pass: env.SMTP_PASS,
    enabled: !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS),
  },

  cloudinary: {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
    enabled: !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY && env.CLOUDINARY_API_SECRET),
  },

  firebase: {
    projectId: env.FIREBASE_PROJECT_ID,
    privateKey: env.FIREBASE_PRIVATE_KEY,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    enabled: !!(env.FIREBASE_PROJECT_ID && env.FIREBASE_PRIVATE_KEY && env.FIREBASE_CLIENT_EMAIL),
  },

  redis: {
    url: env.REDIS_URL,
    enabled: !!env.REDIS_URL,
  },

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },

  frontend: {
    url: env.FRONTEND_URL,
  },

  features: {
    swagger: env.ENABLE_SWAGGER,
    rateLimiting: env.ENABLE_RATE_LIMITING,
    cors: env.ENABLE_CORS,
  },
};

export default config;