
export const successResponse = (res, data, message = 'Success', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString()
  });
};

export const errorResponse = (res, message = 'Internal Server Error', statusCode = 500, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors && { errors }),
    timestamp: new Date().toISOString()
  });
};

export const paginatedResponse = (res, data, pagination, message = 'Success') => {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      ...pagination,
      hasNext: pagination.page < pagination.pages,
      hasPrev: pagination.page > 1
    },
    timestamp: new Date().toISOString()
  });
};

export const validationErrorResponse = (res, errors) => {
  return res.status(400).json({
    success: false,
    message: 'Validation Error',
    errors: errors.array ? errors.array() : errors,
    timestamp: new Date().toISOString()
  });
};
