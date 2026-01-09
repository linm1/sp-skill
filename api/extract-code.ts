import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ai, AxAIGoogleGeminiModel, AxGen } from '@ax-llm/ax';
import { getAuthenticatedUser } from '../lib/auth.js';
import { validateSASCode, validateRCode } from '../lib/validators.js';
import { sanitizePatternTitle, sanitizePromptInput, sanitizeCodeInput } from '../lib/sanitize.js';
import { checkRateLimit } from '../lib/rate-limit.js';

// Request body interface
interface ExtractCodeRequest {
  rawCode: string;
  language: 'sas' | 'r';
  patternTitle: string;
  problemStatement?: string;
  whenToUse?: string;
}

/**
 * Retry a function with exponential backoff
 *
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of retries (default: 3)
 * @param initialDelay - Initial delay in ms (default: 1000)
 * @returns Result of function or throws error
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  initialDelay = 1000
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on client errors (4xx) or final attempt
      if (attempt === maxRetries || (error.status && error.status < 500)) {
        break;
      }

      // Calculate delay: 1s, 2s, 4s
      const delay = initialDelay * Math.pow(2, attempt);

      if (process.env.NODE_ENV === 'development') {
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms...`);
      }

      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError!;
}

// Main handler
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<VercelResponse> {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate user
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Please log in to use code extraction'
    });
  }

  // Check rate limit
  try {
    // Use clerkId for rate limiting (fallback to email if clerkId is null)
    const rateLimitKey = user.clerkId || user.email;
    const rateLimit = await checkRateLimit(rateLimitKey, user.role as 'contributor' | 'premier' | 'admin');

    if (!rateLimit.success) {
      return res.status(429)
        .setHeader('X-RateLimit-Limit', rateLimit.limit.toString())
        .setHeader('X-RateLimit-Remaining', '0')
        .setHeader('X-RateLimit-Reset', rateLimit.reset.toString())
        .json({
          error: 'Rate limit exceeded',
          message: `You have reached your daily limit of ${rateLimit.limit} code extractions. Limit resets in ${Math.ceil((rateLimit.reset - Date.now()) / 1000 / 60)} minutes.`,
          limit: rateLimit.limit,
          reset: rateLimit.reset,
        });
    }

    // Add rate limit headers to successful responses
    res.setHeader('X-RateLimit-Limit', rateLimit.limit.toString());
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining.toString());
    res.setHeader('X-RateLimit-Reset', rateLimit.reset.toString());
  } catch (error) {
    // Graceful degradation: Allow request if rate limiter fails
    console.error('Rate limit check failed, allowing request:', error);
  }

  // Check for API key
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error('GEMINI_API_KEY not configured');
    return res.status(500).json({ error: 'API not configured' });
  }

  // Development-only logging
  if (process.env.NODE_ENV === 'development') {
    console.log('API Key length:', apiKey.length);
  }

  // Validate request body
  const { rawCode, language, patternTitle, problemStatement, whenToUse } = req.body as ExtractCodeRequest;

  if (!rawCode || typeof rawCode !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid rawCode' });
  }

  if (!language || !['sas', 'r'].includes(language)) {
    return res.status(400).json({ error: 'Language must be "sas" or "r"' });
  }

  if (!patternTitle || typeof patternTitle !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid patternTitle' });
  }

  // Limit input size
  if (rawCode.length > 100000) {
    return res.status(400).json({ error: 'Input too large (max 100KB)' });
  }

  // Sanitize all user inputs before using in AI prompts (prevents prompt injection)
  const safePatternTitle = sanitizePatternTitle(patternTitle);
  const safeProblemStatement = sanitizePromptInput(problemStatement || '', 1000);
  const safeWhenToUse = sanitizePromptInput(whenToUse || '', 1000);
  const safeRawCode = sanitizeCodeInput(rawCode);

  // Validate sanitized inputs are not empty
  if (!safePatternTitle) {
    return res.status(400).json({ error: 'Invalid pattern title after sanitization' });
  }

  if (!safeRawCode) {
    return res.status(400).json({ error: 'Invalid code after sanitization' });
  }

  try {
    // Initialize Gemini with Ax
    console.log('Initializing Gemini AI with Ax...');
    console.log('Using model:', AxAIGoogleGeminiModel.Gemini20Flash);

    const llm = ai({
      name: 'google-gemini',
      apiKey: apiKey,
      config: {
        model: AxAIGoogleGeminiModel.Gemini20Flash,
        temperature: 0.1 // Low temperature for deterministic code extraction
      }
    });

    console.log('AI provider initialized:', llm.getName());

    // Create generator with simple string signature
    const languageUpper = language.toUpperCase();

    // Simplify signature - just extract code, make confidence optional
    const generator = new AxGen(
      `"You are an expert clinical statistical programmer. Your task is to extract clean, executable ${languageUpper} code from raw input that contains comments and documentation. 
      Extract ONLY the ${languageUpper} code relevant to the specified clinical programming pattern. Remove all comment lines, documentation headers, and explanatory text. 
      Keep the code properly indented and syntactically correct. The code field must contain the actual ${languageUpper} code, not be empty." 
      rawCode:string, patternTitle:string, problemStatement:string, whenToUse:string -> code:string "The extracted ${languageUpper} code without comments", confidence?:number "Quality score 0-1"`
    );

    // Don't add assertions yet - let's see raw output first
    // We'll add validation after getting the code

    // Execute extraction using sanitized inputs
    console.log('Executing generator.forward with sanitized inputs:', {
      rawCode: safeRawCode.substring(0, 50) + '...',
      patternTitle: safePatternTitle,
      problemStatement: safeProblemStatement,
      whenToUse: safeWhenToUse
    });

    // Wrap Gemini API call with retry logic (3 retries max, 1s initial delay)
    const result = await retryWithBackoff(
      () => generator.forward(llm, {
        rawCode: safeRawCode,
        patternTitle: safePatternTitle,
        problemStatement: safeProblemStatement,
        whenToUse: safeWhenToUse
      }),
      3,  // 3 retries max
      1000 // 1 second initial delay
    );

    console.log('Generation result:', result);

    // Post-process and validate the code
    let extractedCode = result.code || '';

    // Remove markdown code blocks if present
    extractedCode = extractedCode.replace(/^```[\w]*\n?/gm, '').replace(/```$/gm, '');

    // Trim whitespace
    extractedCode = extractedCode.trim();

    // Clean up confidence - extract number and ensure it's valid
    let confidence = 0.8; // Default
    if (result.confidence !== undefined && result.confidence !== null) {
      // Convert to number and clamp between 0 and 1
      const conf = parseFloat(String(result.confidence).replace(/[^\d.]/g, ''));
      if (!isNaN(conf)) {
        confidence = Math.max(0, Math.min(1, conf));
      }
    }

    // Validate the code
    if (!extractedCode) {
      return res.status(422).json({
        error: 'Extraction failed',
        details: 'No code was extracted from the input'
      });
    }

    // Build warnings array
    const warnings = [];

    const validator = language === 'sas' ? validateSASCode : validateRCode;
    const validationResult = validator(extractedCode);

    if (validationResult !== true) {
      console.warn('Syntax validation warning:', validationResult);
      warnings.push(`Syntax check: ${validationResult}`);
    }

    console.log('✅ Code extracted successfully!');
    console.log('Code length:', extractedCode.length);
    console.log('Confidence:', confidence);

    return res.status(200).json({
      success: true,
      code: extractedCode,
      confidence: confidence,
      warnings: warnings,
      language
    });

  } catch (error: any) {
    console.error('Code extraction error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error cause:', error.cause);

    // Check if it's a validation error from assertions
    if (error.message?.includes('Syntax validation failed') ||
        error.message?.includes('Extraction confidence too low')) {
      return res.status(422).json({
        error: 'Extraction failed validation',
        details: error.message
      });
    }

    // Return detailed error in development
    return res.status(500).json({
      error: 'Failed to extract code',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
