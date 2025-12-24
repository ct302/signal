/**
 * Protect LaTeX commands that conflict with JSON escape sequences
 * \f (form feed), \t (tab), \n (newline), \r (carriage return), \b (backspace)
 */
const protectLatexEscapes = (text: string): string => {
  return text
    // Protect \f commands (frac, forall, flat)
    .replace(/\\(frac|forall|flat)(?=[^a-zA-Z]|$)/g, '\\\\$1')
    // Protect \t commands (text, to, tan, theta, times, tau, tilde, top)
    .replace(/\\(text|to|tan|theta|times|tau|tilde|top|textbf)(?=[^a-zA-Z]|$|\{)/g, '\\\\$1')
    // Protect \n commands (nabla, neq, nu, neg, newline, not, nolimits)
    .replace(/\\(nabla|neq|nu|neg|newline|not|nolimits)(?=[^a-zA-Z]|$)/g, '\\\\$1')
    // Protect \r commands (rightarrow, rho, rangle, right, Rightarrow)
    .replace(/\\(rightarrow|rho|rangle|right|Rightarrow)(?=[^a-zA-Z]|$)/g, '\\\\$1')
    // Protect \b commands (beta, bar, boldsymbol, binom, brace, big, Big)
    .replace(/\\(beta|bar|boldsymbol|binom|brace|big|Big)(?=[^a-zA-Z]|$|\{)/g, '\\\\$1');
};

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

  // Protect LaTeX commands before JSON parsing
  clean = protectLatexEscapes(clean);

  try {
    return JSON.parse(clean);
  } catch (e) {
    // Try fixing remaining escape issues
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
