import express from 'express';
import path from 'path';
import fs from 'fs';

// Define the base directory for uploads relative to the *project root*
// Assumes this config file is in src/config/
const uploadsBaseDir = path.join(__dirname, '..', '..', 'uploads');

// Function to setup static file serving
export function setupStaticFiles(app: express.Application): void {
    // Ensure the base uploads directory exists
    if (!fs.existsSync(uploadsBaseDir)) {
        try {
            fs.mkdirSync(uploadsBaseDir, { recursive: true });
            console.log(`[Static Init] Created uploads directory: ${uploadsBaseDir}`);
        } catch (error) {
            console.error(`[Static Init] Error creating uploads directory: ${uploadsBaseDir}`, error);
            // Decide if the server should fail to start or continue without static serving
            // throw error; // Option: Stop server start
            return; // Option: Continue without static serving
        }
    } else {
        console.log(`[Static Init] Uploads directory already exists: ${uploadsBaseDir}`);
    }

    console.log(`[Static] Setting up static file serving for /uploads path from directory: ${uploadsBaseDir}`);
    // Serve files from the 'uploads' directory at the '/uploads' URL path
    app.use('/uploads', express.static(uploadsBaseDir));
} 