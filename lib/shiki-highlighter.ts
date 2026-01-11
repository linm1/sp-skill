import { createHighlighter, type Highlighter } from 'shiki';

// Cache the highlighter instance globally
let highlighterInstance: Highlighter | null = null;

/**
 * Initialize Shiki with SAS custom grammar and R built-in support.
 * This function is idempotent - subsequent calls return the cached instance.
 */
export async function initializeShiki(): Promise<Highlighter> {
  if (highlighterInstance) {
    return highlighterInstance;
  }

  try {
    // Fetch SAS grammar from public directory
    const sasGrammarResponse = await fetch('/grammars/sas.tmLanguage.json');
    if (!sasGrammarResponse.ok) {
      throw new Error(`Failed to load SAS grammar: ${sasGrammarResponse.statusText}`);
    }
    const sasGrammar = await sasGrammarResponse.json();

    // Create highlighter with dual themes (light: rose-pine-dawn, dark: rose-pine-moon) and custom SAS grammar
    highlighterInstance = await createHighlighter({
      themes: ['rose-pine-dawn', 'rose-pine-moon'],
      langs: [
        'r',  // R is built-in
        {
          // Custom SAS grammar
          name: 'sas',
          scopeName: 'source.sas',
          ...sasGrammar,
        },
      ],
    });

    return highlighterInstance;
  } catch (error) {
    console.error('Failed to initialize Shiki:', error);
    throw error;
  }
}

/**
 * Highlight code with Shiki syntax highlighting.
 * @param code - The source code to highlight
 * @param language - The language to use for highlighting ('sas' | 'r')
 * @param theme - The theme to use ('light' | 'dark'), defaults to 'light'
 * @returns HTML string with inline styles
 */
export async function highlightCode(
  code: string,
  language: 'sas' | 'r',
  theme: 'light' | 'dark' = 'light'
): Promise<string> {
  try {
    const highlighter = await initializeShiki();

    // Map user-friendly theme names to Shiki theme IDs
    const shikiTheme = theme === 'light' ? 'rose-pine-dawn' : 'rose-pine-moon';

    return highlighter.codeToHtml(code, {
      lang: language,
      theme: shikiTheme,
    });
  } catch (error) {
    console.error('Failed to highlight code:', error);

    // Fallback: Return plain text in <pre> tag with theme-appropriate styling
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const bgColor = theme === 'light' ? '#fafafa' : '#1e1e1e';
    const textColor = theme === 'light' ? '#383838' : '#d4d4d4';

    return `<pre style="background: ${bgColor}; color: ${textColor}; padding: 1rem; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 12px;">${escapedCode}</pre>`;
  }
}
