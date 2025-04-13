import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as KakaoStrategy } from 'passport-kakao';
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

    // Kakao Strategy
    passport.use(new KakaoStrategy({
        clientID: process.env.KAKAO_CLIENT_ID!,
        clientSecret: process.env.KAKAO_CLIENT_SECRET!,
        callbackURL: process.env.KAKAO_CALLBACK_URL || "http://localhost:3001/api/auth/kakao/callback",
        passReqToCallback: true
    },
    async (req: any, accessToken, refreshToken, profile, done) => {
        console.log('[Kakao Strategy] Profile:', profile);
        const kakaoId = String(profile.id);
        const email = profile._json?.kakao_account?.email; // Try to get email
        const nickname = profile.displayName || profile.username || `kakao_${kakaoId}`; // Use nickname or generate fallback
        const gender = profile._json?.kakao_account?.gender;

        // --- Use nickname if email is unavailable --- 
        const emailOrNickname = email || nickname;
        if (!email) {
            console.warn(`[Kakao Strategy] Email not provided for Kakao ID ${kakaoId}. Using nickname "${nickname}" as identifier.`);
        }
        // -------------------------------------------

        try {
            const existingUser = await User.findOne({ where: { kakaoId: kakaoId } });

            if (existingUser) {
                console.log('[Kakao Strategy] Existing user found:', existingUser.id);
                const isProfileComplete = existingUser.gender && ['male', 'female'].includes(existingUser.gender);

                if (isProfileComplete || existingUser.status !== 'pending_profile_completion') {
                    console.log('[Kakao Strategy] Profile complete or not pending. Authenticating user.');
                    return done(null, existingUser);
                } else {
                    console.log('[Kakao Strategy] Existing user profile incomplete. Storing pending info (using nickname as email if needed).');
                    // ★ Store nickname in email field if email is missing
                    req.session.pendingSocialProfile = { provider: 'kakao', id: kakaoId, email: emailOrNickname, name: nickname, gender };
                    req.session.save((err: any) => {
                        if (err) { return done(err); }
                        console.log('[Kakao Strategy] Session saved for incomplete existing user.');
                        return done(null, false, { message: 'Profile completion required for existing user.' });
                    });
                }
            } else {
                // --- REMOVED: Check for existing user by email --- 
                // const userWithEmail = await User.findOne({ where: { email: emailOrNickname } });
                // if (userWithEmail) { ... return error ... }
                // --------------------------------------------------
                
                // New user via Kakao
                console.log('[Kakao Strategy] New user, storing pending profile in session (using nickname as email if needed).');
                // ★ Store nickname in email field if email is missing
                req.session.pendingSocialProfile = { provider: 'kakao', id: kakaoId, email: emailOrNickname, name: nickname, gender };
                req.session.save((err: any) => {
                    if (err) { return done(err); }
                    console.log('[Kakao Strategy] Session saved for new user.');
                    return done(null, false, { message: 'New user requires profile completion.' });
                });
            }
        } catch (error) {
            console.error('[Kakao Strategy] Error:', error);
            return done(error, false);
        }
    }));

    console.log('[Passport Config] Passport configured (Serialization, Deserialization, Google Strategy, Kakao Strategy).');
} 