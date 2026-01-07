import { ai, AxAIGoogleGeminiModel, AxGen } from '@ax-llm/ax';

// SAS syntax validation helpers
function validateSASCode(code) {
  const trimmed = code.trim();

  if (!trimmed) {
    return "Code cannot be empty";
  }

  // Check for basic SAS structure
  const hasDataStep = /\bdata\s+\w+/i.test(code);
  const hasProcStep = /\bproc\s+\w+/i.test(code);

  if (!hasDataStep && !hasProcStep) {
    return "Code must contain at least one DATA step or PROC step";
  }

  // Check for RUN/QUIT statements
  if (!code.includes(';')) {
    return "SAS code must contain semicolons to terminate statements";
  }

  // Check for balanced quotes
  const singleQuotes = (code.match(/'/g) || []).length;
  const doubleQuotes = (code.match(/"/g) || []).length;

  if (singleQuotes % 2 !== 0) {
    return "Unbalanced single quotes detected";
  }

  if (doubleQuotes % 2 !== 0) {
    return "Unbalanced double quotes detected";
  }

  // Check for obvious syntax errors
  if (/\bdata\s*;/i.test(code)) {
    return "DATA statement missing dataset name";
  }

  return true;
}

// R syntax validation helpers
function validateRCode(code) {
  const trimmed = code.trim();

  if (!trimmed) {
    return "Code cannot be empty";
  }

  // Check for balanced brackets/parentheses
  let parenCount = 0;
  let bracketCount = 0;
  let braceCount = 0;

  for (const char of code) {
    if (char === '(') parenCount++;
    if (char === ')') parenCount--;
    if (char === '[') bracketCount++;
    if (char === ']') bracketCount--;
    if (char === '{') braceCount++;
    if (char === '}') braceCount--;
  }

  if (parenCount !== 0) {
    return "Unbalanced parentheses detected";
  }

  if (bracketCount !== 0) {
    return "Unbalanced square brackets detected";
  }

  if (braceCount !== 0) {
    return "Unbalanced curly braces detected";
  }

  // Check for balanced quotes
  const singleQuotes = (code.match(/(?<!\\)'/g) || []).length;
  const doubleQuotes = (code.match(/(?<!\\)"/g) || []).length;

  if (singleQuotes % 2 !== 0) {
    return "Unbalanced single quotes detected";
  }

  if (doubleQuotes % 2 !== 0) {
    return "Unbalanced double quotes detected";
  }

  // Check for basic R constructs
  const hasAssignment = /<-|=|->/.test(code);
  const hasFunctionCall = /\w+\(/.test(code);

  if (!hasAssignment && !hasFunctionCall) {
    return "Code must contain at least one assignment or function call";
  }

  return true;
}

// Main handler
export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check for API key
  console.log('Raw env GEMINI_API_KEY:', process.env.GEMINI_API_KEY?.substring(0, 10));
  console.log('All GEMINI env vars:', Object.keys(process.env).filter(k => k.includes('GEMINI')));

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error('GEMINI_API_KEY not configured');
    return res.status(500).json({ error: 'API not configured' });
  }

  // Log API key info (first/last 4 chars only for security)
  console.log('API Key length:', apiKey.length);
  console.log('API Key starts with:', apiKey.substring(0, 8));
  console.log('API Key format check:', apiKey.substring(0, 4) + '...' + apiKey.substring(apiKey.length - 4));

  // Validate request body
  const { rawCode, language, patternTitle, problemStatement, whenToUse } = req.body;

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
      `"You are an expert clinical statistical programmer. Your task is to extract clean, executable ${languageUpper} code from raw input that contains comments and documentation. Extract ONLY the ${languageUpper} code relevant to the specified clinical programming pattern. Remove all comment lines, documentation headers, and explanatory text. Keep the code properly indented and syntactically correct. The code field must contain the actual ${languageUpper} code, not be empty." rawCode:string, patternTitle:string, problemStatement:string, whenToUse:string -> code:string "The extracted ${languageUpper} code without comments", confidence?:number "Quality score 0-1"`
    );

    // Don't add assertions yet - let's see raw output first
    // We'll add validation after getting the code

    // Execute extraction
    console.log('Executing generator.forward with inputs:', {
      rawCode: rawCode.substring(0, 50) + '...',
      patternTitle,
      problemStatement: problemStatement || '',
      whenToUse: whenToUse || ''
    });

    const result = await generator.forward(llm, {
      rawCode,
      patternTitle,
      problemStatement: problemStatement || '',
      whenToUse: whenToUse || ''
    });

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

  } catch (error) {
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
