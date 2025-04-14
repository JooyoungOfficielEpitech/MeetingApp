import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import express from 'express';

const PORT = process.env.PORT || 3001;

const swaggerOptions = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'MeetingApp API',
            version: '1.0.0',
            description: 'API documentation for the MeetingApp backend',
        },
        servers: [
            {
                url: process.env.NODE_ENV === 'production'
                    ? process.env.BASE_URL || 'https://meetingapp-backend.onrender.com'
                    : `http://localhost:${PORT}`,
                description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
            },
            // Add other servers like production if needed
        ],
        // Optional: Add components like security schemes (e.g., Bearer Auth for JWT)
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                }
            }
        },
        // Optional: Define global security requirements
        // security: [{
        //     bearerAuth: []
        // }]
    },
    // Path to the API docs files relative to the project root
    // Adjust the glob pattern as needed
    apis: ['./src/routes/*.ts', './src/server.ts'], // Scan route files and maybe server.ts for basic routes
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export function setupSwagger(app: express.Application): void {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    console.log(`[Swagger] UI available at ${process.env.NODE_ENV === 'production' 
        ? process.env.BASE_URL || 'https://meetingapp-backend.onrender.com' 
        : `http://localhost:${PORT}`}/api-docs`);
} 