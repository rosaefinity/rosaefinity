// =============================================
// RosaeFinity — Vercel Entry Point
// Thin wrapper that imports the Express app
// and exports it as a Vercel serverless handler.
//
// The Express app (from server/src/app.ts)
// handles ALL routing internally.
// =============================================

import { createApp } from '../src/app.js';

// Create and export the Express app as the Vercel serverless function handler.
// Vercel routes all requests through this single entry point,
// and Express handles the internal routing (auth, license, devices, etc.).
// Overlay/SSE routes are automatically skipped when VERCEL env var is set.
const app = createApp();

export default app;
