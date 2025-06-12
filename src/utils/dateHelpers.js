
/**
 * Date utility functions for the rental management system
 */

/**
 * Get the start and end dates for a given period
 * @param {string} period - The period type (daily, weekly, monthly, yearly)
 * @param {Date} baseDate - The base date to calculate from
 * @returns {Object} Object containing startDate and endDate
 */
export const getPeriodDates = (period, baseDate = new Date()) => {
  const date = new Date(baseDate);
  let startDate, endDate;

  switch (period) {
    case 'daily':
      startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      break;
    case 'weekly':
      const dayOfWeek = date.getDay();
      startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOfWeek);
      endDate = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dayOfWeek + 7);
      break;
    case 'monthly':
      startDate = new Date(date.getFullYear(), date.getMonth(), 1);
      endDate = new Date(date.getFullYear(), date.getMonth() + 1, 1);
      break;
    case 'yearly':
      startDate = new Date(date.getFullYear(), 0, 1);
      endDate = new Date(date.getFullYear() + 1, 0, 1);
      break;
    default:
      throw new Error('Invalid period type');
  }

  return { startDate, endDate };
};

/**
 * Calculate the number of days between two dates
 * @param {Date} startDate - The start date
 * @param {Date} endDate - The end date
 * @returns {number} Number of days
 */
export const daysBetween = (startDate, endDate) => {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((endDate - startDate) / oneDay));
};

/**
 * Check if a date is overdue
 * @param {Date} dueDate - The due date to check
 * @returns {boolean} True if the date is overdue
 */
export const isOverdue = (dueDate) => {
  return new Date(dueDate) < new Date();
};

/**
 * Get the next due date based on a frequency
 * @param {Date} baseDate - The base date
 * @param {string} frequency - The frequency (monthly, quarterly, yearly)
 * @returns {Date} The next due date
 */
export const getNextDueDate = (baseDate, frequency) => {
  const date = new Date(baseDate);

  switch (frequency) {
    case 'monthly':
      date.setMonth(date.getMonth() + 1);
      break;
    case 'quarterly':
      date.setMonth(date.getMonth() + 3);
      break;
    case 'yearly':
      date.setFullYear(date.getFullYear() + 1);
      break;
    default:
      throw new Error('Invalid frequency type');
  }

  return date;
};

/**
 * Format a date for display
 * @param {Date} date - The date to format
 * @param {string} format - The format type (short, long, time)
 * @returns {string} Formatted date string
 */
export const formatDate = (date, format = 'short') => {
  const options = {
    short: { year: 'numeric', month: 'short', day: 'numeric' },
    long: { year: 'numeric', month: 'long', day: 'numeric' },
    time: { hour: '2-digit', minute: '2-digit' },
    datetime: { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    },
  };

  return new Intl.DateTimeFormat('en-US', options[format]).format(new Date(date));
};

/**
 * Get age from date of birth
 * @param {Date} dateOfBirth - The date of birth
 * @returns {number} Age in years
 */
export const calculateAge = (dateOfBirth) => {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  return age;
};

/**
 * Check if a lease is expiring soon
 * @param {Date} endDate - The lease end date
 * @param {number} daysThreshold - Number of days to consider "soon" (default: 30)
 * @returns {boolean} True if the lease is expiring soon
 */
export const isLeaseExpiringSoon = (endDate, daysThreshold = 30) => {
  const today = new Date();
  const leaseEnd = new Date(endDate);
  const daysUntilExpiry = Math.ceil((leaseEnd - today) / (1000 * 60 * 60 * 24));
  
  return daysUntilExpiry <= daysThreshold && daysUntilExpiry > 0;
};
