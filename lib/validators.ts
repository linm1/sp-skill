/**
 * Code Validation Utilities
 *
 * Provides syntax validation for SAS and R code
 * Used by code extraction endpoints to verify generated code quality
 */

/**
 * Validates SAS code syntax
 * @param code - SAS code to validate
 * @returns true if valid, error message string if invalid
 */
export function validateSASCode(code: string): string | true {
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

/**
 * Validates R code syntax
 * @param code - R code to validate
 * @returns true if valid, error message string if invalid
 */
export function validateRCode(code: string): string | true {
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
