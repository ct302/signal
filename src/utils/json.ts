// Unique placeholder that won't appear in normal text
const BACKSLASH_PLACEHOLDER = '___BKSLSH___';
const QUOTE_PLACEHOLDER = '___QUOT___';

/**
 * ROBUST POST-PROCESSING LAYER
 *
 * The Problem: LLMs return JSON with LaTeX like $\frac{1}{2}$.
 * JSON sees \f as "form feed" escape and fails.
 *
 * The Solution: Replace ALL backslashes with placeholders FIRST,
 * then parse, then restore. This completely sidesteps the conflict.
 */

/**
 * Step 1: Aggressively neutralize all backslashes before any parsing
 * This must happen FIRST, before any other string manipulation
 */
const neutralizeBackslashes = (str: string): string => {
  // Protect escaped quotes first (\" -> placeholder)
  // We need these to stay as \" for JSON parsing
  let result = str.replace(/\\"/g, QUOTE_PLACEHOLDER);

  // Now replace ALL remaining backslashes with placeholder
  // This includes \frac, \bar, \n, \t, everything
  result = result.replace(/\\/g, BACKSLASH_PLACEHOLDER);

  // Restore the escaped quotes (they're needed for JSON structure)
  result = result.replace(new RegExp(QUOTE_PLACEHOLDER, 'g'), '\\"');

  return result;
};

/**
 * Step 2: Fix literal control characters inside strings
 * (actual newline/tab characters, not escape sequences)
 */
const fixControlCharacters = (str: string): string => {
  // Replace literal control characters with spaces
  // After neutralizeBackslashes, we don't have to worry about escape tracking
  return str
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')  // Control chars except \t \n \r
    .replace(/\r\n/g, '\\n')  // Windows line endings
    .replace(/\r/g, '\\n')    // Old Mac line endings
    .replace(/\n/g, '\\n')    // Unix line endings
    .replace(/\t/g, '\\t');   // Tabs
};

/**
 * Step 3: Attempt to repair truncated JSON
 * If the response got cut off, try to close it properly
 */
const repairTruncatedJson = (str: string): string => {
  // Count unclosed braces and brackets
  let braceCount = 0;
  let bracketCount = 0;
  let inString = false;
  let escaped = false;

  for (const char of str) {
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (char === '{') braceCount++;
      else if (char === '}') braceCount--;
      else if (char === '[') bracketCount++;
      else if (char === ']') bracketCount--;
    }
  }

  // If we ended inside a string, close it
  if (inString) {
    str += '"';
  }

  // Close any unclosed brackets/braces
  while (bracketCount > 0) {
    str += ']';
    bracketCount--;
  }
  while (braceCount > 0) {
    str += '}';
    braceCount--;
  }

  return str;
};

/**
 * Step 4: Restore backslash placeholders in parsed object
 */
const restoreBackslashes = (obj: any): any => {
  if (typeof obj === 'string') {
    return obj.replace(new RegExp(BACKSLASH_PLACEHOLDER, 'g'), '\\');
  }
  if (Array.isArray(obj)) {
    return obj.map(restoreBackslashes);
  }
  if (obj && typeof obj === 'object') {
    const result: any = {};
    for (const key in obj) {
      result[key] = restoreBackslashes(obj[key]);
    }
    return result;
  }
  return obj;
};

/**
 * Main entry point: Safely parse JSON from LLM output
 */
export const safeJsonParse = (text: string | null | undefined): any => {
  if (!text) return null;

  // Step 1: Strip markdown code blocks
  let clean = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/g, '')
    .trim();

  if (!clean) return null;

  // Step 2: Extract JSON object
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error('No JSON object found in response');
    return null;
  }

  let jsonString = jsonMatch[0];

  // Step 3: Try parsing as-is first (might already be valid)
  try {
    return JSON.parse(jsonString);
  } catch (e1) {
    // Step 4: Apply our post-processing pipeline
    try {
      // ORDER MATTERS:
      // 1. Neutralize backslashes FIRST (removes all escape conflicts)
      // 2. Fix control characters (now safe because no backslash confusion)
      // 3. Repair truncation (close unclosed strings/braces)
      let processed = neutralizeBackslashes(jsonString);
      processed = fixControlCharacters(processed);
      processed = repairTruncatedJson(processed);

      const parsed = JSON.parse(processed);
      return restoreBackslashes(parsed);
    } catch (e2: any) {
      console.error('JSON parsing failed after post-processing:', e2.message);
      console.error('Raw response (first 500 chars):', jsonString.substring(0, 500));
      console.error('Raw response (last 200 chars):', jsonString.substring(jsonString.length - 200));
      return null;
    }
  }
};

/**
 * Find context data in a nested object by trying multiple key names
 */
export const findContext = (obj: any, keysToFind: string[]): any => {
  if (!obj || typeof obj !== 'object') return null;

  // Direct key match
  for (const key of keysToFind) {
    if (obj[key]) return obj[key];
  }

  // Case-insensitive match
  const lowerKeys = keysToFind.map(k => k.toLowerCase());
  for (const key in obj) {
    if (lowerKeys.includes(key.toLowerCase())) return obj[key];
  }

  // Nested search
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      for (const target of keysToFind) {
        if (obj[key][target]) return obj[key][target];
      }
      for (const subKey in obj[key]) {
        if (lowerKeys.includes(subKey.toLowerCase())) return obj[key][subKey];
      }
    }
  }

  return null;
};
