/**
 * Local Development Server for API Testing
 *
 * This server runs the Vercel serverless functions locally
 * without needing Vercel CLI authentication.
 */

import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50kb' }));

// Dynamic import helper for API routes
async function handleApiRoute(routePath, req, res) {
  try {
    const handler = await import(routePath);
    const defaultExport = handler.default;

    // Create Vercel-compatible request/response objects
    const vercelReq = {
      method: req.method,
      query: req.query,
      body: req.body,
      headers: req.headers,
      url: req.url
    };

    const vercelRes = {
      status: (code) => {
        res.status(code);
        return vercelRes;
      },
      json: (data) => {
        res.json(data);
      },
      send: (data) => {
        res.send(data);
      }
    };

    await defaultExport(vercelReq, vercelRes);
  } catch (error) {
    console.error('Error handling API route:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
}

// API Routes
app.all('/api/analyze', (req, res) => {
  handleApiRoute(join(__dirname, 'api/analyze.ts'), req, res);
});

app.all('/api/patterns', (req, res) => {
  handleApiRoute(join(__dirname, 'api/patterns.ts'), req, res);
});

app.all('/api/patterns/:id', (req, res) => {
  // Add the id to query params for the handler
  req.query.id = req.params.id;
  handleApiRoute(join(__dirname, 'api/patterns/[id].ts'), req, res);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Dev server running' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Dev API Server running on http://localhost:${PORT}`);
  console.log(`📊 API endpoints:`);
  console.log(`   GET  /api/patterns`);
  console.log(`   GET  /api/patterns/:id`);
  console.log(`   POST /api/analyze`);
  console.log(`   GET  /health\n`);
});
