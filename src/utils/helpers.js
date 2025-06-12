
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

export const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

export const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

export const generateToken = (payload, expiresIn = process.env.JWT_EXPIRES_IN || '7d') => {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn });
};

export const verifyToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

export const generateRandomPassword = (length = 12) => {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  for (let i = 0; i < length; i++) {
    password += charset.charAt(Math.floor(Math.random() * charset.length));
  }
  return password;
};

export const generateUUID = () => {
  return uuidv4();
};

export const generateSecureToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

export const formatCurrency = (amount, currency = 'USD') => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
};

export const formatDate = (date, locale = 'en-US') => {
  return new Intl.DateTimeFormat(locale).format(new Date(date));
};

export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidPhone = (phone) => {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
};

export const sanitizeFileName = (fileName) => {
  return fileName.replace(/[^a-z0-9\.\-_]/gi, '_').toLowerCase();
};

export const calculateDaysBetween = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end - start);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

export const isDateExpired = (date) => {
  return new Date(date) < new Date();
};

export const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

export const parseQueryParams = (query) => {
  const params = {};
  
  // Handle pagination
  if (query.page) params.page = parseInt(query.page) || 1;
  if (query.limit) params.limit = Math.min(parseInt(query.limit) || 10, 100);
  
  // Handle sorting
  if (query.sortBy) params.sortBy = query.sortBy;
  if (query.sortOrder) params.sortOrder = query.sortOrder === 'desc' ? 'desc' : 'asc';
  
  // Handle search
  if (query.search) params.search = query.search;
  
  // Handle filters
  if (query.status) params.status = query.status;
  if (query.type) params.type = query.type;
  if (query.startDate) params.startDate = new Date(query.startDate);
  if (query.endDate) params.endDate = new Date(query.endDate);
  
  return params;
};

export const buildPaginationResponse = (data, page, limit, total) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  };
};
