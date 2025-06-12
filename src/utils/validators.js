
import validator from 'validator';

export const isValidPhoneNumber = (phone) => {
  const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
  return phoneRegex.test(phone);
};

export const isValidPostalCode = (code, country = 'US') => {
  const patterns = {
    US: /^\d{5}(-\d{4})?$/,
    CA: /^[A-Za-z]\d[A-Za-z] \d[A-Za-z]\d$/,
    UK: /^[A-Z]{1,2}\d[A-Z\d]? \d[A-Z]{2}$/
  };
  
  return patterns[country]?.test(code) || false;
};

export const isStrongPassword = (password) => {
  const strongPasswordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return strongPasswordRegex.test(password);
};

export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return validator.escape(input.trim());
};

export const isValidAmount = (amount) => {
  return typeof amount === 'number' && amount > 0 && Number.isFinite(amount);
};

export const isValidDate = (date) => {
  return date instanceof Date && !isNaN(date.getTime());
};

export const isValidCoordinates = (lat, lng) => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 && lat <= 90 &&
    lng >= -180 && lng <= 180
  );
};
