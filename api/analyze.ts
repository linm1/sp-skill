import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from '@google/genai';
import { getAuthenticatedUser } from '../lib/auth.js';

// Response schema for structured output
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    sasCode: { type: Type.STRING },
    rCode: { type: Type.STRING },
    considerations: { type: Type.ARRAY, items: { type: Type.STRING } },
    variations: { type: Type.ARRAY, items: { type: Type.STRING } },
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Authenticate user
  const user = await getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Please log in to use AI analysis features'
    });
  }

  // Check for API key on server side
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not configured');
    return res.status(500).json({ error: 'API not configured' });
  }

  // Validate request body
  const { patternTitle, rawInput } = req.body;

  if (!patternTitle || typeof patternTitle !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid patternTitle' });
  }

  if (!rawInput || typeof rawInput !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid rawInput' });
  }

  // Limit input size to prevent abuse
  if (rawInput.length > 50000) {
    return res.status(400).json({ error: 'Input too large (max 50000 characters)' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
      You are an expert Clinical Statistical Programmer.
      Extract code implementation details for the pattern: "${patternTitle}".

      The Output must be a valid JSON object matching this schema:
      {
          "sasCode": "The SAS code implementation (clean up indentation)",
          "rCode": "The R code implementation (clean up indentation)",
          "considerations": ["List of strings", "warnings or dependencies"],
          "variations": ["List of related pattern names"]
      }

      Input Text:
      ${rawInput}
    `;

    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema
      }
    });

    const extracted = JSON.parse(response.text || "{}");

    return res.status(200).json(extracted);
  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: 'Failed to analyze content' });
  }
}
