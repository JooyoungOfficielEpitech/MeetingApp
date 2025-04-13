import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
// import { User } from '../db/models'; // Adjust path if necessary
const db = require('../../models'); // Correct path and use require
const User = db.User;

// TODO: Consider moving strategy callback logic to a dedicated controller/service

export function configurePassport() {
    // Serialization
    passport.serializeUser((user: any, done) => {
        console.log('[Passport Serialize] User ID:', user.id);
        done(null, user.id);
    });

    // Deserialization
    passport.deserializeUser(async (id: string, done) => {
        console.log('[Passport Deserialize] Looking for user ID:', id);
        try {
            const user = await User.findByPk(id); // User is now defined via require
            if (user) {
                console.log('[Passport Deserialize] User found:', user.toJSON());
            } else {
                console.warn('[Passport Deserialize] User NOT found for ID:', id);
            }
            done(null, user); // Pass user object (or null if not found)
        } catch (error) {
            console.error('[Passport Deserialize] Error:', error);
            done(error);
        }
    });

    // Google OAuth 2.0 Strategy
    passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || "http://localhost:3001/api/auth/google/callback",
        scope: ['profile', 'email'],
        passReqToCallback: true
      },
      async (req: any, accessToken, refreshToken, profile, done) => {
        console.log('[Google Strategy] Profile Received:', profile);
        try {
          let user = await User.findOne({ where: { googleId: profile.id } }); // User is now defined via require

          if (user) {
            console.log('[Google Strategy] Existing user found:', user.toJSON());
            return done(null, user);
          } else {
            console.log('[Google Strategy] New user, storing pending profile in session.');
            const pendingProfile = {
                provider: 'google',
                id: profile.id,
                email: profile.emails?.[0]?.value,
                name: profile.displayName,
            };
            // Attach to session - the callback route will handle saving
            req.session.pendingSocialProfile = pendingProfile;
            console.log('[Google Strategy] Calling done(null, false) for new user.');
            return done(null, false); // Signal new user, no user object yet
          }
        } catch (error) {
          console.error('[Google Strategy] Error:', error);
          return done(error, false);
        }
      }
    ));

    console.log('[Passport Config] Passport configured (Serialization, Deserialization, Google Strategy).');
} 