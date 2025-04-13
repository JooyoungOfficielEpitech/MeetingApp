import bcrypt from 'bcrypt';
const db = require('../../models'); // Adjust path from src/utils/ to models/
const User = db.User;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'root@root.com';
// IMPORTANT: Use environment variables for sensitive data like admin passwords
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'alpine';
const SALT_ROUNDS = 10; // Consider making this configurable

export const ensureAdminUser = async () => {
  if (!ADMIN_PASSWORD) {
      console.warn('[Admin Check] ADMIN_PASSWORD environment variable is not set. Skipping admin creation/check.');
      return;
  }

  try {
    let existingAdmin = await User.findOne({ where: { email: ADMIN_EMAIL } });

    if (!existingAdmin) {
      console.log(`[Admin Check] Admin user (${ADMIN_EMAIL}) not found. Creating...`);
      const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);

      existingAdmin = await User.create({
        email: ADMIN_EMAIL,
        passwordHash: passwordHash,
        name: 'Root Admin',
        gender: 'other', // Consider making gender nullable or having a default
        isAdmin: true,
        occupation: 'Admin', // Default occupation
        status: 'active' // Ensure admin is active
      });
      console.log(`[Admin Check] Admin user (${ADMIN_EMAIL}) created successfully.`);

    } else {
        let needsUpdate = false;
        let updateFields: { isAdmin?: boolean; status?: string; passwordHash?: string } = {};

        if (!existingAdmin.isAdmin) {
            console.log(`[Admin Check] Existing user (${ADMIN_EMAIL}) is not admin. Updating...`);
            updateFields.isAdmin = true;
            needsUpdate = true;
        }

        if (existingAdmin.status !== 'active') {
             console.log(`[Admin Check] Existing admin user (${ADMIN_EMAIL}) is not active (${existingAdmin.status}). Updating status to active...`);
             updateFields.status = 'active';
             needsUpdate = true;
        }

        // Optional: Check if the stored password needs updating (e.g., if ADMIN_PASSWORD changed)
        // This requires comparing the provided ADMIN_PASSWORD with the stored hash.
        // const isPasswordMatch = await bcrypt.compare(ADMIN_PASSWORD, existingAdmin.passwordHash);
        // if (!isPasswordMatch) {
        //     console.log(`[Admin Check] Admin password needs update for (${ADMIN_EMAIL}). Updating...`);
        //     updateFields.passwordHash = await bcrypt.hash(ADMIN_PASSWORD, SALT_ROUNDS);
        //     needsUpdate = true;
        // }

        if (needsUpdate) {
            await existingAdmin.update(updateFields);
            // await existingAdmin.save(); // .update performs save
            console.log(`[Admin Check] Admin user (${ADMIN_EMAIL}) updated.`);
        } else {
             console.log(`[Admin Check] Admin user (${ADMIN_EMAIL}) already exists and is configured correctly.`);
        }
    }
  } catch (error) {
    console.error('[Admin Check] Error ensuring admin user:', error);
    // Decide if this error should prevent server startup
    // throw error;
  }
}; 