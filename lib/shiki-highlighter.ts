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

    // Create highlighter with GitHub Dark theme and custom SAS grammar
    highlighterInstance = await createHighlighter({
      themes: ['github-dark'],
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
 * @returns HTML string with inline styles
 */
export async function highlightCode(
  code: string,
  language: 'sas' | 'r'
): Promise<string> {
  try {
    const highlighter = await initializeShiki();

    return highlighter.codeToHtml(code, {
      lang: language,
      theme: 'github-dark',
    });
  } catch (error) {
    console.error('Failed to highlight code:', error);

    // Fallback: Return plain text in <pre> tag with basic styling
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return `<pre style="background: #1e1e1e; color: #d4d4d4; padding: 1rem; overflow-x: auto; font-family: 'Courier New', monospace; font-size: 12px;">${escapedCode}</pre>`;
  }
}
