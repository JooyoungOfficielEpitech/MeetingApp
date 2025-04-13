import session from 'express-session';

// TODO: Configure session store for production (e.g., connect-redis, connect-mongo)
// const RedisStore = require('connect-redis')(session); // Example
// const redisClient = require('redis').createClient(); // Example

const SESSION_SECRET = process.env.SESSION_SECRET || 'default_fallback_secret_change_me';

export const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  // store: new RedisStore({ client: redisClient }), // Example for production
  cookie: {
    // secure: process.env.NODE_ENV === 'production', // Use secure cookies in production (HTTPS)
    httpOnly: true, // Helps prevent XSS attacks
    // maxAge: 1000 * 60 * 60 * 24 // Optional: e.g., 1 day
  }
}); 