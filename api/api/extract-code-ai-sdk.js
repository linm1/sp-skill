/**
 * Code Extraction API Endpoint - Ax AI SDK Provider Implementation
 *
 * Uses @ax-llm/ax-ai-sdk-provider for proper Vercel AI SDK v5 integration
 * with Google Gemini for intelligent code extraction from raw documentation.
 *
 * This implementation follows the recommended Ax + Vercel integration pattern:
 * 1. Initialize Ax AI instance with Google Gemini
 * 2. Wrap with AxAIProvider for AI SDK v5 compatibility
 * 3. Use generateText() for structured extraction
 *
 * @see https://github.com/ax-llm/ax - Ax framework documentation
 */
import { ai, AxAIGoogleGeminiModel } from '@ax-llm/ax';
import { AxAIProvider } from '@ax-llm/ax-ai-sdk-provider';
import { generateText } from 'ai';
import { getAuthenticatedUser } from '../lib/auth.js';
import { validateSASCode, validateRCode } from '../lib/validators.js';
/**
 * Main handler for code extraction endpoint
 */
export default async function handler(req, res) {
    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    // Authenticate user
    const user = await getAuthenticatedUser(req);
    if (!user) {
        return res.status(401).json({
            error: 'Unauthorized',
            message: 'Please log in to use code extraction',
        });
    }
    // Validate API key exists
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        console.error('GEMINI_API_KEY not configured');
        return res.status(500).json({
            error: 'Server configuration error',
            message: 'API key not configured',
        });
    }
    // Validate request body
    const { rawCode, language, patternTitle, problemStatement, whenToUse, } = req.body;
    if (!rawCode || typeof rawCode !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid rawCode' });
    }
    if (!language || !['sas', 'r'].includes(language)) {
        return res.status(400).json({ error: 'Language must be "sas" or "r"' });
    }
    if (!patternTitle || typeof patternTitle !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid patternTitle' });
    }
    // Limit input size (100KB)
    if (rawCode.length > 100000) {
        return res.status(400).json({ error: 'Input too large (max 100KB)' });
    }
    try {
        console.log('[AI SDK] Initializing Gemini with AxAIProvider...');
        // Step 1: Initialize Ax AI instance with Google Gemini
        const axAI = ai({
            name: 'google-gemini',
            apiKey: apiKey,
            config: {
                model: AxAIGoogleGeminiModel.Gemini20Flash,
                temperature: 0.1, // Low temperature for deterministic code extraction
            },
        });
        // Step 2: Wrap with AxAIProvider for Vercel AI SDK v5 compatibility
        const model = new AxAIProvider(axAI);
        console.log('[AI SDK] Provider initialized:', axAI.getName());
        // Step 3: Build extraction prompt
        const languageUpper = language.toUpperCase();
        const systemPrompt = `You are an expert clinical statistical programmer specializing in ${languageUpper} code extraction.

Your task is to extract clean, executable ${languageUpper} code from raw input that may contain:
- Comments and documentation
- Explanatory text
- Header information
- Multiple code blocks

EXTRACTION RULES:
1. Extract ONLY the ${languageUpper} code relevant to: "${patternTitle}"
2. Remove all comment lines, documentation headers, and explanatory text
3. Keep the code properly indented and syntactically correct
4. If multiple code blocks exist, extract the most relevant one
5. Ensure the code is complete and executable

OUTPUT FORMAT:
Return a JSON object with exactly these fields:
{
  "code": "the extracted ${languageUpper} code without comments",
  "confidence": 0.85
}

The confidence score should be between 0.0 and 1.0, representing extraction quality:
- 0.9-1.0: Perfect extraction, high certainty
- 0.7-0.9: Good extraction, minor uncertainty
- 0.5-0.7: Moderate extraction, some concerns
- 0.0-0.5: Poor extraction, low confidence`;
        const userPrompt = `Extract ${languageUpper} code for pattern: "${patternTitle}"

${problemStatement ? `Problem: ${problemStatement}\n` : ''}${whenToUse ? `When to use: ${whenToUse}\n` : ''}
Raw input:
\`\`\`
${rawCode}
\`\`\`

Respond with JSON only (no markdown, no code fences).`;
        // Step 4: Execute extraction using AI SDK generateText
        console.log('[AI SDK] Executing generateText...');
        const result = await generateText({
            model: model, // Type cast due to version mismatch in @ai-sdk dependencies
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
        });
        console.log('[AI SDK] Generation complete');
        console.log('[AI SDK] Response length:', result.text.length);
        // Step 5: Parse response
        let extractedData;
        try {
            // Remove potential markdown code fences
            let cleanedText = result.text.trim();
            cleanedText = cleanedText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '');
            extractedData = JSON.parse(cleanedText);
        }
        catch (parseError) {
            console.error('[AI SDK] JSON parse error:', parseError);
            console.error('[AI SDK] Raw response:', result.text);
            return res.status(422).json({
                error: 'Extraction failed',
                details: 'AI response was not valid JSON',
            });
        }
        // Step 6: Validate extraction
        let extractedCode = (extractedData.code || '').trim();
        if (!extractedCode) {
            return res.status(422).json({
                error: 'Extraction failed',
                details: 'No code was extracted from the input',
            });
        }
        // Clean up any remaining markdown code blocks
        extractedCode = extractedCode
            .replace(/^```[\w]*\n?/gm, '')
            .replace(/```$/gm, '')
            .trim();
        // Parse confidence
        let confidence = 0.8; // Default
        if (extractedData.confidence !== undefined && extractedData.confidence !== null) {
            const conf = parseFloat(String(extractedData.confidence));
            if (!isNaN(conf)) {
                confidence = Math.max(0, Math.min(1, conf));
            }
        }
        // Step 7: Validate code syntax
        const warnings = [];
        const validator = language === 'sas' ? validateSASCode : validateRCode;
        const validationResult = validator(extractedCode);
        if (validationResult !== true) {
            console.warn('[AI SDK] Syntax validation warning:', validationResult);
            warnings.push(`Syntax check: ${validationResult}`);
        }
        // Step 8: Return successful response
        console.log('[AI SDK] ✅ Code extracted successfully');
        console.log('[AI SDK] Code length:', extractedCode.length);
        console.log('[AI SDK] Confidence:', confidence);
        console.log('[AI SDK] Warnings:', warnings.length);
        return res.status(200).json({
            success: true,
            code: extractedCode,
            confidence: confidence,
            warnings: warnings,
            language: language,
        });
    }
    catch (error) {
        console.error('[AI SDK] Code extraction error:', error);
        console.error('[AI SDK] Error stack:', error.stack);
        // Check for specific error types
        if (error.message?.includes('API key')) {
            return res.status(500).json({
                error: 'API configuration error',
                details: 'Invalid API key',
            });
        }
        if (error.message?.includes('rate limit')) {
            return res.status(429).json({
                error: 'Rate limit exceeded',
                details: 'Please try again later',
            });
        }
        // Generic error response
        return res.status(500).json({
            error: 'Failed to extract code',
            details: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
        });
    }
}
