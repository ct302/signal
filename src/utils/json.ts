/**
 * Safely parse JSON with fallback handling for common issues
 */
export const safeJsonParse = (text: string | null | undefined): any => {
  if (!text) return null;

  let clean = text
    .replace(/```json\s*/g, "")
    .replace(/```\s*/g, "")
    .replace(/\s*```$/g, "")
    .trim();

  if (!clean) return null;

  try {
    return JSON.parse(clean);
  } catch (e) {
    // Try fixing common escape issues
    const fixed = clean.replace(/\\(?!["\\/bfnrtu])/g, "\\\\");
    try {
      return JSON.parse(fixed);
    } catch (e2) {
      console.error("JSON parsing failed completely:", e2);
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
