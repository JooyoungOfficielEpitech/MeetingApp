import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import cors from 'cors';

const app = express();
const server = http.createServer(app);

// --- CORS Configuration --- 
const corsOptions = {
  origin: 'http://localhost:3000', // Allow only the frontend origin
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"], // Allow common methods
  allowedHeaders: ["Content-Type", "Authorization"], // Allow necessary headers
  credentials: true // Allow cookies/authorization headers
};
app.use(cors(corsOptions)); // Use cors middleware with specific options
// Handle preflight requests for all routes
// app.options('*', cors(corsOptions)); // Optional: More explicit preflight handling if needed
// --------------------------

const io = new SocketIOServer(server, {
    cors: {
        origin: "http://localhost:3000", // Keep this for Socket.IO specifically
        methods: ["GET", "POST"]
    }
});

// Swagger definition
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
                url: `http://localhost:${process.env.PORT || 3001}`,
                description: 'Development server'
            }
        ]
    },
    // Path to the API docs (typically routes files)
    // For now, we'll point to this server file for the example
    apis: ['./src/server.ts', './src/routes/*.ts'], // Scan routes files too
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Serve Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Middleware to parse JSON bodies
app.use(express.json());

// Import and use routes
import authRoutes from './routes/auth';
import profileRoutes from './routes/profile';
app.use('/api/auth', authRoutes);
app.use('/api/users', profileRoutes);

const PORT = process.env.PORT || 3001; // Use a different port than frontend

/**
 * @swagger
 * /:
 *   get:
 *     summary: Check if the backend server is running
 *     tags: [Server Status]
 *     responses:
 *       200:
 *         description: Server is running
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: Backend server is running!
 */
app.get('/', (req, res) => {
    res.send('Backend server is running!');
});

/**
 * @swagger
 * tags:
 *   name: Example
 *   description: Example API endpoint
 */

/**
 * @swagger
 * /hello:
 *   get:
 *     summary: Returns a simple hello message
 *     tags: [Example]
 *     responses:
 *       200:
 *         description: A hello message
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Hello from the backend!
 */
app.get('/hello', (req, res) => {
    res.json({ message: 'Hello from the backend!' });
});

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Handle chat message event (example)
    socket.on('chat message', (msg: string) => {
        console.log('message: ' + msg);
        // Broadcast message to everyone including sender
        io.emit('chat message', msg);
    });

    // Handle user disconnection
    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });

    // Add more Socket.IO event handlers here (e.g., joining rooms, private messages)
});

server.listen(PORT, () => {
    console.log(`Server listening on *:${PORT}`);
    console.log(`Swagger UI available at http://localhost:${PORT}/api-docs`); // Log Swagger URL
}); 