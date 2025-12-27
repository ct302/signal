// Unique placeholder that won't appear in normal text
const BACKSLASH_PLACEHOLDER = '___BKSLSH___';

/**
 * NUCLEAR OPTION v2: Replace backslashes with placeholder, parse, then restore.
 * This completely sidesteps JSON escape sequence issues with LaTeX.
 */
const replaceBackslashesWithPlaceholder = (str: string): string => {
  // First, handle already-escaped quotes \" -> keep them as escaped quotes
  let result = str.replace(/\\"/g, '___ESCAPED_QUOTE___');

  // Now replace remaining backslashes with placeholder
  result = result.replace(/\\/g, BACKSLASH_PLACEHOLDER);

  // Restore escaped quotes
  result = result.replace(/___ESCAPED_QUOTE___/g, '\\"');

  return result;
};

/**
 * Restore backslash placeholders in all string values of parsed object
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
 * Fix literal newlines inside JSON string values (which are invalid JSON)
 * Converts actual newlines to escaped \n sequences
 */
const fixNewlinesInStrings = (jsonStr: string): string => {
  // Match string values and replace literal newlines with \n
  // This regex finds strings and replaces newlines inside them
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      result += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      result += char;
      continue;
    }

    if (inString && (char === '\n' || char === '\r')) {
      // Replace literal newlines inside strings with escaped version
      result += '\\n';
      continue;
    }

    if (inString && char === '\t') {
      // Replace literal tabs inside strings with escaped version
      result += '\\t';
      continue;
    }

    result += char;
  }

  return result;
};

/**
 * Safely parse JSON with fallback handling for common issues
 */
export const safeJsonParse = (text: string | null | undefined): any => {
  if (!text) return null;

  // Step 1: Strip markdown code blocks
  let clean = text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  if (!clean) return null;

  // Step 2: Extract JSON object if wrapped in other text
  const jsonMatch = clean.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("No JSON object found in response");
    return null;
  }

  let jsonString = jsonMatch[0];

  // Step 3: First attempt - try parsing as-is (might already be valid)
  try {
    return JSON.parse(jsonString);
  } catch (e1) {
    // Step 4: Fix literal newlines inside strings, then try again
    try {
      const fixedNewlines = fixNewlinesInStrings(jsonString);
      return JSON.parse(fixedNewlines);
    } catch (e2) {
      // Step 5: NUCLEAR OPTION - fix newlines + replace backslashes with placeholder
      try {
        const fixedNewlines = fixNewlinesInStrings(jsonString);
        const withPlaceholders = replaceBackslashesWithPlaceholder(fixedNewlines);
        const parsed = JSON.parse(withPlaceholders);
        return restoreBackslashes(parsed);
      } catch (e3: any) {
        console.error("JSON parsing failed completely:", e3);
        console.error("Raw response (first 500 chars):", jsonString.substring(0, 500));
        return null;
      }
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
