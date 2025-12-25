/**
 * Protect LaTeX commands that conflict with JSON escape sequences
 * \f (form feed), \t (tab), \n (newline), \r (carriage return), \b (backspace)
 * Also protect common math commands that might not be properly escaped
 */
const protectLatexEscapes = (text: string): string => {
  return text
    // Protect \f commands (frac, forall, flat)
    .replace(/\\(frac|forall|flat)(?=[^a-zA-Z]|$|\{)/g, '\\\\$1')
    // Protect \t commands (text, to, tan, theta, times, tau, tilde, top)
    .replace(/\\(text|to|tan|theta|times|tau|tilde|top|textbf)(?=[^a-zA-Z]|$|\{)/g, '\\\\$1')
    // Protect \n commands (nabla, neq, nu, neg, newline, not, nolimits)
    .replace(/\\(nabla|neq|nu|neg|newline|not|nolimits)(?=[^a-zA-Z]|$)/g, '\\\\$1')
    // Protect \r commands (rightarrow, rho, rangle, right, Rightarrow)
    .replace(/\\(rightarrow|rho|rangle|right|Rightarrow)(?=[^a-zA-Z]|$)/g, '\\\\$1')
    // Protect \b commands (beta, bar, boldsymbol, binom, brace, big, Big)
    .replace(/\\(beta|bar|boldsymbol|binom|brace|big|Big)(?=[^a-zA-Z]|$|\{)/g, '\\\\$1')
    // Protect \m commands (mathbf, mathrm, mathcal, mathbb, mod, max, min)
    .replace(/\\(mathbf|mathrm|mathcal|mathbb|mathit|mod|max|min)(?=[^a-zA-Z]|$|\{)/g, '\\\\$1')
    // Protect \c commands (cdot, cos, cot, cap, cup, circ)
    .replace(/\\(cdot|cos|cot|cap|cup|circ|chi)(?=[^a-zA-Z]|$)/g, '\\\\$1')
    // Protect \a commands (approx, alpha, ast, angle)
    .replace(/\\(approx|alpha|ast|angle)(?=[^a-zA-Z]|$)/g, '\\\\$1')
    // Protect \s commands (sqrt, sin, sum, sigma, subset, supset, sim)
    .replace(/\\(sqrt|sin|sum|sigma|subset|supset|sim|star)(?=[^a-zA-Z]|$|\{)/g, '\\\\$1')
    // Protect \l commands (lambda, langle, left, leq, log, ln, ldots, lim)
    .replace(/\\(lambda|langle|left|leq|log|ln|ldots|lim|limits)(?=[^a-zA-Z]|$)/g, '\\\\$1')
    // Protect \g commands (gamma, geq, gg)
    .replace(/\\(gamma|geq|gg)(?=[^a-zA-Z]|$)/g, '\\\\$1')
    // Protect \p commands (pi, pm, partial, phi, psi, prime, prod)
    .replace(/\\(pi|pm|partial|phi|psi|prime|prod)(?=[^a-zA-Z]|$)/g, '\\\\$1')
    // Protect \d commands (delta, div, det)
    .replace(/\\(delta|div|det)(?=[^a-zA-Z]|$)/g, '\\\\$1')
    // Protect \e commands (epsilon, eta, exp, equiv, exists)
    .replace(/\\(epsilon|eta|exp|equiv|exists)(?=[^a-zA-Z]|$)/g, '\\\\$1')
    // Protect \i commands (int, infty, in, iota)
    .replace(/\\(int|infty|in|iota)(?=[^a-zA-Z]|$)/g, '\\\\$1')
    // Protect \o commands (omega, oplus, otimes)
    .replace(/\\(omega|oplus|otimes)(?=[^a-zA-Z]|$)/g, '\\\\$1')
    // Protect \v commands (vec, vee)
    .replace(/\\(vec|vee|varepsilon)(?=[^a-zA-Z]|$|\{)/g, '\\\\$1');
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
