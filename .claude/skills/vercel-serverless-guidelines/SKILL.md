---
name: vercel-serverless-guidelines
description: Backend development guide for Vercel Serverless Functions with Node.js/TypeScript. Use when creating API routes, serverless functions, database operations, error tracking, input validation with Zod, and implementing business logic in serverless architecture. Covers function patterns, error handling, environment variables, cold start optimization, and testing strategies.
---

# Vercel Serverless Function Guidelines

## Purpose

Establish consistency and best practices for Vercel serverless functions using Node.js/TypeScript patterns, with a focus on performance, security, and maintainability.

## When to Use This Skill

Automatically activates when working on:
- Creating or modifying API routes in `/api` directory
- Implementing serverless functions
- Database operations
- Error tracking
- Input validation with Zod
- Environment variable management
- Serverless function testing and optimization

---

## Quick Start

### New Serverless Function Checklist

- [ ] **Function File**: `api/[route].ts` with proper export
- [ ] **Type Safety**: Request/Response types
- [ ] **Validation**: Zod schema for input
- [ ] **Error Handling**: Try-catch with proper error responses
- [ ] **Error Tracking**: Sentry integration (if applicable)
- [ ] **Environment Vars**: Use `process.env` with validation
- [ ] **Response Format**: Consistent JSON structure
- [ ] **CORS**: Handle CORS headers if needed
- [ ] **Cold Start Optimization**: Minimize imports, use connection pooling

---

## Architecture Principles

### Serverless Function Structure

```
Request
    ↓
API Route Handler (api/route.ts)
    ↓
Validation (Zod)
    ↓
Business Logic (inline or service layer)
    ↓
Data Access (database client)
    ↓
Response (JSON)
```

**Key Principle:** Keep functions focused and lightweight.

---

## Directory Structure

```
api/
├── analyze.ts              # AI analysis endpoint
├── patterns/
│   ├── index.ts           # List patterns
│   └── [id].ts            # Get pattern by ID
├── auth/
│   ├── login.ts           # Authentication
│   └── verify.ts          # Token verification
└── _middleware/           # Shared utilities
    ├── validation.ts      # Validation helpers
    ├── errors.ts          # Error handlers
    └── database.ts        # DB connection

lib/                       # Shared business logic
├── services/
│   └── patternService.ts
└── utils/
    └── helpers.ts
```

**Naming Conventions:**
- API routes: `kebab-case` - `analyze.ts`, `get-user.ts`
- Services: `camelCase` - `patternService.ts`
- Utilities: `camelCase` - `errorHandler.ts`

---

## Core Principles (7 Key Rules)

### 1. Every Function is an Entry Point

```typescript
// ❌ NEVER: Shared state between invocations
let cache = {}; // Dangerous! Shared across invocations

// ✅ ALWAYS: Stateless functions
export default async function handler(req: Request, res: Response) {
    // Fresh execution context
}
```

### 2. Validate All Input with Zod

```typescript
import { z } from 'zod';

const schema = z.object({
    text: z.string().min(1).max(50000),
    mode: z.enum(['sas', 'r']).optional(),
});

export default async function handler(req: Request, res: Response) {
    try {
        const validated = schema.parse(req.body);
        // Use validated data
    } catch (error) {
        return res.status(400).json({ error: 'Invalid input' });
    }
}
```

### 3. Handle Errors Consistently

```typescript
export default async function handler(req: Request, res: Response) {
    try {
        // Business logic
        const result = await processData(req.body);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error in handler:', error);

        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.errors
            });
        }

        return res.status(500).json({
            error: 'Internal server error',
            message: error instanceof Error ? error.message : 'Unknown error'
        });
    }
}
```

### 4. Environment Variables are Sacred

```typescript
// ❌ NEVER: Direct access without validation
const apiKey = process.env.GEMINI_API_KEY;

// ✅ ALWAYS: Validate and provide defaults
const getConfig = () => {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured');
    }

    return { apiKey };
};

export default async function handler(req: Request, res: Response) {
    const config = getConfig();
    // Use config.apiKey
}
```

### 5. Optimize for Cold Starts

```typescript
// ❌ NEVER: Heavy imports at top level
import * as tf from '@tensorflow/tfjs'; // Slow cold start

// ✅ PREFER: Dynamic imports when needed
export default async function handler(req: Request, res: Response) {
    if (req.body.needsML) {
        const tf = await import('@tensorflow/tfjs');
        // Use tf
    }
}

// ✅ ALSO GOOD: Connection reuse
let cachedDb: any = null;

async function getDatabase() {
    if (cachedDb) return cachedDb;

    cachedDb = await connectToDatabase();
    return cachedDb;
}
```

### 6. Use Proper HTTP Methods

```typescript
export default async function handler(req: Request, res: Response) {
    // Handle different HTTP methods
    switch (req.method) {
        case 'GET':
            return handleGet(req, res);
        case 'POST':
            return handlePost(req, res);
        case 'PUT':
            return handlePut(req, res);
        case 'DELETE':
            return handleDelete(req, res);
        default:
            return res.status(405).json({ error: 'Method not allowed' });
    }
}
```

### 7. Implement Request Size Limits

```typescript
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '50kb', // Prevent abuse
        },
    },
};

export default async function handler(req: Request, res: Response) {
    // Function logic
}
```

---

## Common Imports

```typescript
// Vercel
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Validation
import { z } from 'zod';

// AI (example: Google Gemini)
import { GoogleGenerativeAI } from '@google/genai';

// Database (generic - adapt to your DB)
import { connectToDatabase } from '../lib/database';

// Utilities
import { errorResponse, successResponse } from '../lib/responses';
```

---

## Function Templates

### Basic GET Endpoint

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    // Only allow GET
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
            return res.status(400).json({ error: 'Missing id parameter' });
        }

        // Business logic
        const data = await fetchData(id);

        return res.status(200).json({ success: true, data });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
```

### POST Endpoint with Validation

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { z } from 'zod';

const requestSchema = z.object({
    email: z.string().email(),
    name: z.string().min(1),
    age: z.number().int().positive().optional(),
});

type RequestBody = z.infer<typeof requestSchema>;

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Validate input
        const validated: RequestBody = requestSchema.parse(req.body);

        // Business logic
        const result = await createUser(validated);

        return res.status(201).json({
            success: true,
            data: result
        });
    } catch (error) {
        if (error instanceof z.ZodError) {
            return res.status(400).json({
                error: 'Validation failed',
                details: error.errors
            });
        }

        console.error('Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function createUser(data: RequestBody) {
    // Database operation
    return { id: 1, ...data };
}
```

### With Environment Variables

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Validate env at module load (fails fast)
const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is required');
}

export default async function handler(
    req: VercelRequest,
    res: VercelResponse
) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Use API_KEY securely
        const result = await callExternalAPI(API_KEY, req.body);
        return res.status(200).json({ success: true, data: result });
    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

async function callExternalAPI(apiKey: string, data: any) {
    // External API call
    return { processed: true };
}
```

---

## Security Best Practices

### 1. Never Expose Secrets

```typescript
// ❌ NEVER
return res.json({ apiKey: process.env.SECRET_KEY });

// ✅ ALWAYS keep secrets server-side
const apiKey = process.env.SECRET_KEY;
const result = await externalService(apiKey);
return res.json({ result }); // Only return result
```

### 2. Validate Request Origin (CORS)

```typescript
export default async function handler(req: VercelRequest, res: VercelResponse) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', 'https://yourdomain.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Rest of handler...
}
```

### 3. Rate Limiting Considerations

```typescript
// Implement rate limiting at application level or use Vercel's built-in protection
// For custom implementation, use Redis or Vercel KV

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
    redis: Redis.fromEnv(),
    limiter: Ratelimit.slidingWindow(10, '10 s'),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const identifier = req.headers['x-forwarded-for'] as string || 'anonymous';
    const { success } = await ratelimit.limit(identifier);

    if (!success) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    // Handle request
}
```

---

## Performance Optimization

### Cold Start Best Practices

1. **Minimize Dependencies**: Only import what you need
2. **Connection Pooling**: Reuse database connections
3. **Lazy Loading**: Dynamic imports for heavy libraries
4. **Edge Functions**: Use Vercel Edge for latency-sensitive operations

### Example: Connection Pooling

```typescript
// lib/database.ts
let cachedConnection: any = null;

export async function getDatabase() {
    if (cachedConnection) {
        return cachedConnection;
    }

    // Create new connection
    cachedConnection = await createConnection();
    return cachedConnection;
}
```

---

## Testing Serverless Functions

### Local Testing

```typescript
// __tests__/api/analyze.test.ts
import { createMocks } from 'node-mocks-http';
import handler from '../../api/analyze';

describe('/api/analyze', () => {
    it('should validate input', async () => {
        const { req, res } = createMocks({
            method: 'POST',
            body: { text: 'test' },
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(200);
        expect(JSON.parse(res._getData())).toHaveProperty('success');
    });

    it('should reject invalid input', async () => {
        const { req, res } = createMocks({
            method: 'POST',
            body: {},
        });

        await handler(req, res);

        expect(res._getStatusCode()).toBe(400);
    });
});
```

---

## Core Principles Summary

1. **Stateless**: No shared state between invocations
2. **Validate Everything**: Use Zod for all inputs
3. **Handle Errors**: Consistent error responses
4. **Secure Secrets**: Never expose environment variables
5. **Optimize Cold Starts**: Minimize imports, reuse connections
6. **HTTP Standards**: Proper methods and status codes
7. **Size Limits**: Prevent abuse with request limits

---

## Vercel-Specific Considerations

### Function Configuration

```typescript
// api/my-function.ts
export const config = {
    maxDuration: 10, // seconds (hobby: 10s, pro: 60s, enterprise: 900s)
    runtime: 'nodejs20.x',
};
```

### Environment Variables

- Set in Vercel Dashboard → Settings → Environment Variables
- Access via `process.env.VARIABLE_NAME`
- Separate for Development, Preview, Production

### Edge Functions (Optional)

For ultra-low latency, consider Vercel Edge Functions:

```typescript
export const config = {
    runtime: 'edge',
};

export default async function handler(req: Request) {
    return new Response(JSON.stringify({ hello: 'world' }), {
        headers: { 'content-type': 'application/json' },
    });
}
```

---

**Skill Status**: Adapted for Vercel Serverless Functions architecture
