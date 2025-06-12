
import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Rental Management System API',
      version: '1.0.0',
      description: 'Production-ready rental management system backend API',
      contact: {
        name: 'API Support',
        email: 'support@rentalmanagement.com',
      },
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://your-domain.com/api/v1' 
          : `http://localhost:${process.env.PORT || 5000}/api/v1`,
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/modules/*/routes/*.js', './src/modules/*/controllers/*.js'],
};

const specs = swaggerJsdoc(options);

export default specs;
