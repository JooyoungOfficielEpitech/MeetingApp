import dotenv from 'dotenv';
dotenv.config(); // Ensure environment variables are loaded

// Validate that the JWT_SECRET environment variable is set
if (!process.env.JWT_SECRET) {
    console.error("FATAL ERROR: JWT_SECRET is not defined in environment variables.");
    // Optionally, exit the process if the secret is absolutely required
    // process.exit(1);
}

// Use a strong, unique secret key stored in environment variables
export const JWT_SECRET = process.env.JWT_SECRET || 'fallback_very_secret_key_change_this_immediately';

// Consider adding other JWT related configurations here, like:
// export const JWT_EXPIRATION = '1h'; // Example: Token expiration time
// export const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'another_fallback_secret';
// export const REFRESH_TOKEN_EXPIRATION = '7d';

// Log a warning if the fallback secret is used (only in non-production environments)
if (process.env.NODE_ENV !== 'production' && JWT_SECRET === 'fallback_very_secret_key_change_this_immediately') {
    console.warn("WARNING: Using default fallback JWT_SECRET. Set a strong JWT_SECRET environment variable for security.");
} 