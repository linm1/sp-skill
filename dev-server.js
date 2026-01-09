/**
 * Local development server for API endpoints
 * Workaround for Vercel CLI es-module-lexer issue
 */

import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';

// Load environment variables
config({ path: '.env.local' });

const app = express();
const PORT = 3002;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Import the TypeScript handler
app.post('/api/extract-code', async (req, res) => {
  try {
    const module = await import('./api/extract-code.ts');
    const handler = module.default;
    await handler(req, res);
  } catch (error) {
    console.error('Handler error:', error);
    res.status(500).json({
      error: 'Internal server error',
      details: error.message,
      stack: error.stack
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Dev server running on http://localhost:${PORT}`);
});
