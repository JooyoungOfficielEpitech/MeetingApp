import dotenv from 'dotenv';
dotenv.config(); // Load environment variables from .env file

import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import cors from 'cors';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20'; // Import Google Strategy
import jwt from 'jsonwebtoken'; // Import jwt for token generation

// --- Import User model --- 
const db = require('../models'); // Adjust path if needed
const User = db.User;
// -------------------------

// --- JWT Secret --- 
const JWT_SECRET = process.env.JWT_SECRET || 'YOUR_VERY_SECRET_KEY_CHANGE_ME'; // Reuse or define a specific one
// ------------------

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

// --- Session Configuration --- 
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'default_fallback_secret_change_me', // Use env variable
    resave: false,
    saveUninitialized: false, // Changed to false: don't save sessions until something is stored
    // Configure session store for production (e.g., connect-redis, connect-mongo)
    // cookie: { secure: process.env.NODE_ENV === 'production' } // Use secure cookies in production (HTTPS)
  })
);
// ---------------------------

// --- Passport Configuration ---
app.use(passport.initialize());
app.use(passport.session());

// --- Passport Serialization/Deserialization (Updated) --- 
passport.serializeUser((user: any, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    // Retrieve the full user object from the database using the ID
    const user = await User.findByPk(id); // Use actual User model
    done(null, user); // Pass the user object or null if not found
  } catch (error) {
    done(error);
  }
});
// ----------------------------------------------------

// --- Google OAuth 2.0 Strategy Configuration --- 
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3001/api/auth/google/callback",
    scope: ['profile', 'email'] // Request profile and email information
  },
  async (accessToken, refreshToken, profile, done) => {
    // This function is called after successful authentication by Google
    try {
      console.log('Google Profile Received:', profile); // Log received profile

      // Find user by Google ID
      let user = await User.findOne({ where: { googleId: profile.id } });

      if (!user) {
        // If user doesn't exist, try finding by email (optional, consider security implications)
        // user = await User.findOne({ where: { email: profile.emails?.[0]?.value } });
        
        // If still no user, create a new one
        // if (!user) { 
          user = await User.create({
            googleId: profile.id,
            email: profile.emails?.[0]?.value, // Make sure email is verified
            name: profile.displayName,
            // Set passwordHash to null or a random value for social logins? Decide strategy.
            // passwordHash: null, 
            // Add default values for other required fields if any
          });
          console.log('New user created via Google:', user.toJSON());
        // }
      }

      // Pass the user object to Passport
      done(null, user);

    } catch (error) {
      console.error('Error in Google Strategy callback:', error);
      done(error, undefined);
    }
  }
));
// ----------------------------------------------- 

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

// --- Google Auth Routes --- 
// 1. Route to start Google authentication
app.get('/api/auth/google', 
  passport.authenticate('google') // Redirects to Google login
);

// 2. Google callback route
app.get('/api/auth/google/callback',
  passport.authenticate('google', { 
    failureRedirect: 'http://localhost:3000/login?error=google_auth_failed', // Redirect to frontend login on failure
    session: false // Don't rely on session, generate JWT instead
  }),
  (req: any, res) => {
    // Successful authentication, req.user should contain the user from the strategy's done() callback
    if (!req.user) {
        return res.redirect('http://localhost:3000/login?error=authentication_failed');
    }
    
    // Generate JWT for the logged-in user
    const payload = { userId: req.user.id, email: req.user.email }; 
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });

    // Redirect back to the frontend, passing the token
    // Common method: use query parameters
    res.redirect(`http://localhost:3000/auth/callback?token=${token}`); 
  }
);
// --------------------------

app.use('/api/auth', authRoutes); // Mount local auth routes AFTER Google routes if they share base path
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