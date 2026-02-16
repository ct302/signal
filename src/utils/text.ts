import { LATEX_CMD_REGEX } from '../constants';

/**
 * NUCLEAR SANITIZATION - Applied to raw API response BEFORE JSON parsing
 * This catches ALL math symbols at the source, preventing any from reaching the UI
 */
export const sanitizeRawApiResponse = (rawText: string): string => {
  if (!rawText) return rawText;

  let result = rawText;

  // ============================================================
  // PART 1: Strip math symbols from ANALOGY fields in the JSON
  // Target: "analogy_explanation", "analogy", "narrative" fields
  // ============================================================

  // Helper to strip symbols from a JSON string value
  const stripSymbolsFromValue = (value: string): string => {
    let cleaned = value;

    // ALL arrow variants (comprehensive list)
    cleaned = cleaned.replace(/→/g, ' to ');
    cleaned = cleaned.replace(/←/g, ' from ');
    cleaned = cleaned.replace(/↔/g, ' and ');
    cleaned = cleaned.replace(/⟶/g, ' to ');
    cleaned = cleaned.replace(/⟵/g, ' from ');
    cleaned = cleaned.replace(/⇒/g, ' leads to ');
    cleaned = cleaned.replace(/⇔/g, ' equals ');
    cleaned = cleaned.replace(/⇐/g, ' from ');
    cleaned = cleaned.replace(/➔/g, ' to ');
    cleaned = cleaned.replace(/➜/g, ' to ');
    cleaned = cleaned.replace(/➝/g, ' to ');
    cleaned = cleaned.replace(/➞/g, ' to ');
    cleaned = cleaned.replace(/⟹/g, ' leads to ');
    cleaned = cleaned.replace(/⟸/g, ' from ');

    // Set notation
    cleaned = cleaned.replace(/∈/g, ' in ');
    cleaned = cleaned.replace(/∉/g, ' not in ');
    cleaned = cleaned.replace(/∋/g, ' contains ');
    cleaned = cleaned.replace(/⊂/g, ' within ');
    cleaned = cleaned.replace(/⊃/g, ' contains ');
    cleaned = cleaned.replace(/⊆/g, ' within ');
    cleaned = cleaned.replace(/⊇/g, ' contains ');
    cleaned = cleaned.replace(/∪/g, ' and ');
    cleaned = cleaned.replace(/∩/g, ' and ');

    // Math operators
    cleaned = cleaned.replace(/∑/g, 'the total of ');
    cleaned = cleaned.replace(/∫/g, 'the accumulation of ');
    cleaned = cleaned.replace(/∂/g, '');
    cleaned = cleaned.replace(/∇/g, '');
    cleaned = cleaned.replace(/∆/g, 'change in ');
    cleaned = cleaned.replace(/Δ/g, 'change in ');
    cleaned = cleaned.replace(/×/g, ' times ');
    cleaned = cleaned.replace(/÷/g, ' divided by ');
    cleaned = cleaned.replace(/±/g, ' plus or minus ');
    cleaned = cleaned.replace(/∞/g, 'endlessly');
    cleaned = cleaned.replace(/≈/g, ' approximately ');
    cleaned = cleaned.replace(/≠/g, ' differs from ');
    cleaned = cleaned.replace(/≤/g, ' at most ');
    cleaned = cleaned.replace(/≥/g, ' at least ');
    cleaned = cleaned.replace(/⊗/g, ' combined with ');
    cleaned = cleaned.replace(/⊕/g, ' combined with ');

    // Greek letters (standalone)
    cleaned = cleaned.replace(/α/g, '');
    cleaned = cleaned.replace(/β/g, '');
    cleaned = cleaned.replace(/γ/g, '');
    cleaned = cleaned.replace(/δ/g, '');
    cleaned = cleaned.replace(/θ/g, '');
    cleaned = cleaned.replace(/λ/g, '');
    cleaned = cleaned.replace(/μ/g, '');
    cleaned = cleaned.replace(/ν/g, '');
    cleaned = cleaned.replace(/π/g, '');
    cleaned = cleaned.replace(/σ/g, '');
    cleaned = cleaned.replace(/τ/g, '');
    cleaned = cleaned.replace(/Σ/g, 'total');
    cleaned = cleaned.replace(/Π/g, 'product');

    // Subscript/superscript numbers
    cleaned = cleaned.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, '');
    cleaned = cleaned.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, '');

    // Remove $...$ LaTeX blocks from analogy text
    cleaned = cleaned.replace(/\$[^$]+\$/g, '');

    // Fix \not patterns BEFORE removing LaTeX commands
    // \not renders as "/" in LaTeX, so convert to readable text
    cleaned = cleaned.replace(/\\not\s*\\?empty/gi, 'not empty');
    cleaned = cleaned.replace(/\\not\s*\\?in\b/gi, 'not in');
    cleaned = cleaned.replace(/\\not\s*=/g, 'not equal to');
    cleaned = cleaned.replace(/\\not\s*\\?subset/gi, 'not a subset of');
    cleaned = cleaned.replace(/\\not\s*\\?equiv/gi, 'not equivalent to');
    cleaned = cleaned.replace(/\\neq/g, 'not equal to');
    cleaned = cleaned.replace(/\\notin/g, 'not in');
    // Catch any remaining \not followed by anything
    cleaned = cleaned.replace(/\\not\s*/g, 'not ');

    // Remove orphaned LaTeX commands (backslash followed by letters)
    cleaned = cleaned.replace(/\\[a-zA-Z]+/g, '');

    // Clean up multiple spaces
    cleaned = cleaned.replace(/\s{2,}/g, ' ');

    return cleaned;
  };

  // Target specific JSON fields that should be pure prose (analogy fields)
  // Pattern: "field_name": "value" - we replace the value part
  const analogyFields = [
    'analogy_explanation',
    'analogyExplanation',
    'analogy',
    'narrative'
  ];

  for (const field of analogyFields) {
    // Match "field": "value" pattern in JSON (handles escaped quotes in value)
    const regex = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`,'g');
    result = result.replace(regex, (match, value) => {
      const cleanedValue = stripSymbolsFromValue(value);
      return `"${field}": "${cleanedValue}"`;
    });
  }

  // Also clean the "analogy" field inside segments array
  // Pattern: "analogy": "value" within segments
  result = result.replace(/"analogy"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/g, (match, value) => {
    const cleanedValue = stripSymbolsFromValue(value);
    return `"analogy": "${cleanedValue}"`;
  });

  // Clean narrative fields inside segments
  result = result.replace(/"narrative"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"/g, (match, value) => {
    const cleanedValue = stripSymbolsFromValue(value);
    return `"narrative": "${cleanedValue}"`;
  });

  // ============================================================
  // PART 2: Fix malformed LaTeX in TECHNICAL fields
  // Target: "technical_explanation", "tech" fields
  // Fix: "\ μ" -> "\mu", "\ π" -> "\pi", etc.
  // ============================================================

  const technicalFields = ['technical_explanation', 'technicalExplanation', 'tech'];

  for (const field of technicalFields) {
    const regex = new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`,'g');
    result = result.replace(regex, (match, value) => {
      let fixedValue = value;

      // Fix spaces after backslashes before Greek letters
      // "\ μ" -> "\mu", "\ π" -> "\pi", etc.
      fixedValue = fixedValue.replace(/\\\s+μ/g, '\\\\mu');
      fixedValue = fixedValue.replace(/\\\s+ν/g, '\\\\nu');
      fixedValue = fixedValue.replace(/\\\s+π/g, '\\\\pi');
      fixedValue = fixedValue.replace(/\\\s+α/g, '\\\\alpha');
      fixedValue = fixedValue.replace(/\\\s+β/g, '\\\\beta');
      fixedValue = fixedValue.replace(/\\\s+γ/g, '\\\\gamma');
      fixedValue = fixedValue.replace(/\\\s+δ/g, '\\\\delta');
      fixedValue = fixedValue.replace(/\\\s+θ/g, '\\\\theta');
      fixedValue = fixedValue.replace(/\\\s+λ/g, '\\\\lambda');
      fixedValue = fixedValue.replace(/\\\s+σ/g, '\\\\sigma');
      fixedValue = fixedValue.replace(/\\\s+τ/g, '\\\\tau');
      fixedValue = fixedValue.replace(/\\\s+Σ/g, '\\\\Sigma');
      fixedValue = fixedValue.replace(/\\\s+Π/g, '\\\\Pi');
      fixedValue = fixedValue.replace(/\\\s+∇/g, '\\\\nabla');
      fixedValue = fixedValue.replace(/\\\s+⊗/g, '\\\\otimes');
      fixedValue = fixedValue.replace(/\\\s+⊕/g, '\\\\oplus');

      // Fix standalone Greek Unicode symbols outside of $ - convert to LaTeX
      fixedValue = fixedValue.replace(/(?<!\$[^$]*)μ(?![^$]*\$)/g, '$\\\\mu$');
      fixedValue = fixedValue.replace(/(?<!\$[^$]*)ν(?![^$]*\$)/g, '$\\\\nu$');

      return `"${field}": "${fixedValue}"`;
    });
  }

  return result;
};

/**
 * Strip mathematical symbols and notation from analogy text
 * This is a safety net to ensure pure prose in analogical explanations
 */
export const stripMathSymbols = (text: string): string => {
  if (!text) return "";

  let result = text;

  // ============================================================
  // ARROWS - All variants (COMPREHENSIVE)
  // ============================================================
  result = result.replace(/\s*→\s*/g, ' to ');
  result = result.replace(/\s*←\s*/g, ' from ');
  result = result.replace(/\s*↔\s*/g, ' and ');
  result = result.replace(/\s*⟶\s*/g, ' to ');
  result = result.replace(/\s*⟵\s*/g, ' from ');
  result = result.replace(/\s*⇒\s*/g, ' leads to ');
  result = result.replace(/\s*⇔\s*/g, ' equals ');
  result = result.replace(/\s*⇐\s*/g, ' from ');
  result = result.replace(/\s*➔\s*/g, ' to ');
  result = result.replace(/\s*➜\s*/g, ' to ');
  result = result.replace(/\s*➝\s*/g, ' to ');
  result = result.replace(/\s*➞\s*/g, ' to ');
  result = result.replace(/\s*⟹\s*/g, ' leads to ');
  result = result.replace(/\s*⟸\s*/g, ' from ');
  result = result.replace(/\s*↦\s*/g, ' maps to ');
  result = result.replace(/\s*⇀\s*/g, ' to ');
  result = result.replace(/\s*↪\s*/g, ' into ');

  // ============================================================
  // GEOMETRY SYMBOLS (CRITICAL - These were missing!)
  // ============================================================
  result = result.replace(/∠/g, 'angle');
  result = result.replace(/∡/g, 'angle');
  result = result.replace(/∢/g, 'angle');
  result = result.replace(/△/g, 'triangle');
  result = result.replace(/▲/g, 'triangle');
  result = result.replace(/▵/g, 'triangle');
  result = result.replace(/◯/g, 'circle');
  result = result.replace(/○/g, 'circle');
  result = result.replace(/⊥/g, 'perpendicular to');
  result = result.replace(/∥/g, 'parallel to');
  result = result.replace(/≅/g, 'congruent to');
  result = result.replace(/∼/g, 'similar to');
  result = result.replace(/⊿/g, 'right triangle');

  // ============================================================
  // LOGICAL OPERATORS (CRITICAL - ∧ was missing!)
  // ============================================================
  result = result.replace(/∧/g, ' and ');
  result = result.replace(/∨/g, ' or ');
  result = result.replace(/¬/g, 'not ');
  result = result.replace(/⊻/g, ' exclusive or ');
  result = result.replace(/⊼/g, ' nand ');
  result = result.replace(/⊽/g, ' nor ');
  result = result.replace(/⇏/g, ' does not imply ');
  result = result.replace(/∀/g, 'for all ');
  result = result.replace(/∃/g, 'there exists ');
  result = result.replace(/∄/g, 'there does not exist ');

  // ============================================================
  // SET THEORY
  // ============================================================
  result = result.replace(/\s*∈\s*/g, ' in ');
  result = result.replace(/\s*∉\s*/g, ' not in ');
  result = result.replace(/\s*∋\s*/g, ' contains ');
  result = result.replace(/\s*⊂\s*/g, ' within ');
  result = result.replace(/\s*⊃\s*/g, ' contains ');
  result = result.replace(/\s*⊆\s*/g, ' within ');
  result = result.replace(/\s*⊇\s*/g, ' contains ');
  result = result.replace(/\s*∪\s*/g, ' and ');
  result = result.replace(/\s*∩\s*/g, ' and ');
  result = result.replace(/∅/g, 'nothing');
  result = result.replace(/⌀/g, 'nothing');

  // ============================================================
  // CALCULUS & ANALYSIS SYMBOLS
  // ============================================================
  result = result.replace(/∑/g, 'the total of');
  result = result.replace(/∫/g, 'the accumulation of');
  result = result.replace(/∬/g, 'the double accumulation of');
  result = result.replace(/∭/g, 'the triple accumulation of');
  result = result.replace(/∮/g, 'the loop accumulation of');
  result = result.replace(/∂/g, '');
  result = result.replace(/∇/g, '');
  result = result.replace(/∆/g, 'change in ');
  result = result.replace(/Δ/g, 'change in ');
  result = result.replace(/∏/g, 'the product of');

  // ============================================================
  // COMPARISON & EQUALITY
  // ============================================================
  result = result.replace(/\s*≈\s*/g, ' approximately ');
  result = result.replace(/\s*≠\s*/g, ' differs from ');
  result = result.replace(/\s*≤\s*/g, ' at most ');
  result = result.replace(/\s*≥\s*/g, ' at least ');
  result = result.replace(/\s*≪\s*/g, ' much less than ');
  result = result.replace(/\s*≫\s*/g, ' much greater than ');
  result = result.replace(/\s*<\s*/g, ' less than ');
  result = result.replace(/\s*>\s*/g, ' more than ');
  result = result.replace(/≡/g, ' identical to ');
  result = result.replace(/≢/g, ' not identical to ');
  result = result.replace(/≃/g, ' approximately ');
  result = result.replace(/≄/g, ' not approximately ');

  // ============================================================
  // ARITHMETIC OPERATORS
  // ============================================================
  result = result.replace(/×/g, ' times ');
  result = result.replace(/÷/g, ' divided by ');
  result = result.replace(/±/g, ' plus or minus ');
  result = result.replace(/∓/g, ' minus or plus ');
  result = result.replace(/∞/g, 'endlessly');
  result = result.replace(/√/g, 'square root of ');
  result = result.replace(/□/g, 'square ');
  result = result.replace(/∝/g, ' proportional to ');
  result = result.replace(/⊗/g, ' combined with ');
  result = result.replace(/⊕/g, ' combined with ');
  result = result.replace(/⊖/g, ' without ');
  result = result.replace(/⊘/g, ' divided by ');
  result = result.replace(/⊙/g, ' with ');
  result = result.replace(/·/g, ' times ');
  result = result.replace(/•/g, ' times ');
  result = result.replace(/∘/g, ' composed with ');

  // ============================================================
  // GREEK LETTERS (remove entirely - they're math notation)
  // ============================================================
  // Lowercase Greek
  result = result.replace(/α/g, '');
  result = result.replace(/β/g, '');
  result = result.replace(/γ/g, '');
  result = result.replace(/δ/g, '');
  result = result.replace(/ε/g, '');
  result = result.replace(/ζ/g, '');
  result = result.replace(/η/g, '');
  result = result.replace(/θ/g, '');
  result = result.replace(/ι/g, '');
  result = result.replace(/κ/g, '');
  result = result.replace(/λ/g, '');
  result = result.replace(/μ/g, '');
  result = result.replace(/ν/g, '');
  result = result.replace(/ξ/g, '');
  result = result.replace(/ο/g, '');
  result = result.replace(/π/g, '');
  result = result.replace(/ρ/g, '');
  result = result.replace(/σ/g, '');
  result = result.replace(/ς/g, '');
  result = result.replace(/τ/g, '');
  result = result.replace(/υ/g, '');
  result = result.replace(/φ/g, '');
  result = result.replace(/χ/g, '');
  result = result.replace(/ψ/g, '');
  result = result.replace(/ω/g, '');
  // Uppercase Greek
  result = result.replace(/Α/g, '');
  result = result.replace(/Β/g, '');
  result = result.replace(/Γ/g, '');
  result = result.replace(/Δ/g, 'change in '); // Keep semantic meaning
  result = result.replace(/Ε/g, '');
  result = result.replace(/Ζ/g, '');
  result = result.replace(/Η/g, '');
  result = result.replace(/Θ/g, '');
  result = result.replace(/Ι/g, '');
  result = result.replace(/Κ/g, '');
  result = result.replace(/Λ/g, '');
  result = result.replace(/Μ/g, '');
  result = result.replace(/Ν/g, '');
  result = result.replace(/Ξ/g, '');
  result = result.replace(/Ο/g, '');
  result = result.replace(/Π/g, 'product of ');
  result = result.replace(/Ρ/g, '');
  result = result.replace(/Σ/g, 'total of ');
  result = result.replace(/Τ/g, '');
  result = result.replace(/Υ/g, '');
  result = result.replace(/Φ/g, '');
  result = result.replace(/Χ/g, '');
  result = result.replace(/Ψ/g, '');
  result = result.replace(/Ω/g, '');

  // ============================================================
  // SUBSCRIPT/SUPERSCRIPT NUMBERS
  // ============================================================
  result = result.replace(/[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎]/g, '');
  result = result.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾]/g, '');

  // ============================================================
  // MISCELLANEOUS MATH SYMBOLS
  // ============================================================
  result = result.replace(/ℕ/g, 'natural numbers');
  result = result.replace(/ℤ/g, 'integers');
  result = result.replace(/ℚ/g, 'rational numbers');
  result = result.replace(/ℝ/g, 'real numbers');
  result = result.replace(/ℂ/g, 'complex numbers');
  result = result.replace(/ℵ/g, '');
  result = result.replace(/℘/g, '');
  result = result.replace(/ℏ/g, '');
  result = result.replace(/ℓ/g, '');
  result = result.replace(/′/g, '');  // Prime
  result = result.replace(/″/g, '');  // Double prime
  result = result.replace(/‴/g, '');  // Triple prime
  result = result.replace(/°/g, ' degrees');

  // ============================================================
  // LATEX CLEANUP
  // ============================================================
  // Remove inline LaTeX blocks ($...$) entirely from analogy
  result = result.replace(/\$[^$]+\$/g, '');

  // Remove any remaining LaTeX commands that slipped through
  result = result.replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, '');

  // ============================================================
  // FINAL CLEANUP
  // ============================================================
  // Clean up multiple spaces
  result = result.replace(/\s{2,}/g, ' ');

  // Clean up spaces before punctuation
  result = result.replace(/\s+([.,;:!?])/g, '$1');

  return result.trim();
};

/**
 * Clean text by replacing common unicode issues
 */
export const cleanText = (text: string | null | undefined): string => {
  if (!text || typeof text !== 'string') return "";
  return text
    .replace(/â€"/g, " - ")
    .replace(/â€"/g, " - ")
    .replace(/"/g, '"')
    .replace(/"/g, '"')
    .replace(/'/g, "'")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
};

/**
 * Fix unicode escape sequences in text
 */
export const fixUnicode = (text: string | null | undefined): string => {
  if (!text || typeof text !== 'string') return "";
  return text
    .replace(/\\U([0-9a-fA-F]{8})/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
};

/**
 * Convert escape sequences like \n, \t, \r to actual characters
 * This handles the output from safeJsonParse where backslashes are restored
 * but escape sequences weren't converted to actual control characters.
 *
 * Note: We convert \n to space (not newline) since our display is inline prose.
 */
export const unescapeControlSequences = (text: string | null | undefined): string => {
  if (!text || typeof text !== 'string') return "";
  return text
    // CRITICAL: Only match \n, \r, \t when NOT followed by a letter
    // Otherwise we destroy LaTeX commands: \times -> " imes", \theta -> " heta",
    // \nabla -> " abla", \nu -> " u", \rho -> " ho", \tau -> " au", etc.
    .replace(/\\n(?![a-zA-Z])/g, ' ')   // \n but not \nabla, \neq, \nu, \neg, \not, etc.
    .replace(/\\r(?![a-zA-Z])/g, ' ')   // \r but not \rho, \rangle, \rightarrow, etc.
    .replace(/\\t(?![a-zA-Z])/g, ' ')   // \t but not \times, \theta, \tau, \text, \tilde, etc.
    .replace(/\s{2,}/g, ' ')            // Collapse multiple spaces to single
    .replace(/\\\\/g, '\\');            // Handle escaped backslashes
};

/**
 * Fix LaTeX commands that are missing backslashes
 * e.g., "mathbf{x}" -> "\mathbf{x}", "cdot" -> "\cdot"
 *
 * This is a recovery mechanism for when LLM outputs lose backslashes
 * during JSON parsing or other text processing.
 */
const fixMissingBackslashes = (text: string): string => {
  // Comprehensive list of LaTeX commands that might appear without backslash
  const commands = [
    // Text formatting
    'mathbf', 'mathrm', 'mathcal', 'mathbb', 'mathit', 'mathsf', 'mathtt',
    'textbf', 'textrm', 'textit', 'textsf', 'texttt', 'text', 'mbox',
    'boldsymbol', 'bm',

    // Fractions and roots
    'frac', 'dfrac', 'tfrac', 'cfrac', 'sqrt', 'root',

    // Big operators
    'sum', 'prod', 'int', 'iint', 'iiint', 'oint', 'coprod',
    'bigcup', 'bigcap', 'bigsqcup', 'bigvee', 'bigwedge', 'bigoplus', 'bigotimes',

    // Limits and bounds
    'lim', 'limsup', 'liminf', 'sup', 'inf', 'max', 'min',

    // Accents and decorations (CRITICAL - these were missing!)
    // NOTE: Removed 'dot' - too common in "dot product" phrase
    'tilde', 'widetilde', 'hat', 'widehat', 'bar', 'overline', 'underline',
    'vec', 'overrightarrow', 'overleftarrow', 'ddot', 'dddot',
    'acute', 'grave', 'breve', 'check', 'ring',
    'overbrace', 'underbrace', 'overleftrightarrow',

    // Dots (CRITICAL - these were missing!)
    'dots', 'ldots', 'cdots', 'vdots', 'ddots',

    // Greek letters - lowercase
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon',
    'zeta', 'eta', 'theta', 'vartheta', 'iota', 'kappa', 'lambda',
    'mu', 'nu', 'xi', 'omicron', 'pi', 'varpi', 'rho', 'varrho',
    'sigma', 'varsigma', 'tau', 'upsilon', 'phi', 'varphi', 'chi', 'psi', 'omega',

    // Greek letters - uppercase
    'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon',
    'Phi', 'Psi', 'Omega',

    // Binary operators
    'cdot', 'times', 'div', 'pm', 'mp', 'ast', 'star', 'circ', 'bullet',
    'oplus', 'ominus', 'otimes', 'oslash', 'odot',
    'wedge', 'vee', 'cap', 'cup', 'setminus',

    // Relations
    'approx', 'neq', 'leq', 'geq', 'll', 'gg', 'prec', 'succ',
    'preceq', 'succeq', 'sim', 'simeq', 'cong', 'equiv', 'propto',
    'subset', 'supset', 'subseteq', 'supseteq', 'in', 'notin', 'ni',
    'parallel', 'perp', 'mid', 'nmid',

    // Arrows
    'rightarrow', 'leftarrow', 'Rightarrow', 'Leftarrow',
    'leftrightarrow', 'Leftrightarrow', 'longrightarrow', 'longleftarrow',
    'Longrightarrow', 'Longleftarrow', 'mapsto', 'longmapsto',
    'uparrow', 'downarrow', 'Uparrow', 'Downarrow', 'updownarrow',
    'nearrow', 'searrow', 'swarrow', 'nwarrow',
    'hookrightarrow', 'hookleftarrow', 'rightharpoonup', 'rightharpoondown',

    // Delimiters (only include ones that can render standalone)
    // NOTE: Removed 'left', 'right', 'big', 'Big', 'bigg', 'Bigg' - these need matching pairs
    'langle', 'rangle', 'lfloor', 'rfloor', 'lceil', 'rceil',
    'lvert', 'rvert', 'lVert', 'rVert',

    // Spacing
    'quad', 'qquad', 'hspace', 'vspace', 'hfill', 'vfill',

    // Special symbols
    'infty', 'partial', 'nabla', 'prime', 'backprime',
    'forall', 'exists', 'nexists', 'emptyset', 'varnothing',
    'neg', 'lnot', 'land', 'lor', 'implies', 'iff',
    'aleph', 'beth', 'hbar', 'ell', 'wp', 'Re', 'Im',
    'angle', 'measuredangle', 'sphericalangle',
    'triangle', 'square', 'diamond', 'Box', 'Diamond',
    'clubsuit', 'diamondsuit', 'heartsuit', 'spadesuit',

    // Functions
    'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
    'arcsin', 'arccos', 'arctan', 'arccot',
    'sinh', 'cosh', 'tanh', 'coth',
    'log', 'ln', 'lg', 'exp', 'arg', 'deg',
    'det', 'dim', 'gcd', 'hom', 'ker', 'Pr',

    // Calculus and analysis
    // NOTE: Removed 'to' - too common as English word
    'gets', 'leadsto',

    // NOTE: Removed entire matrices/environments section - these can't render standalone:
    // 'begin', 'end', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix',
    // 'cases', 'array', 'aligned', 'gathered'

    // Misc
    'not', 'stackrel', 'overset', 'underset', 'atop', 'choose',
    'binom', 'tbinom', 'dbinom',
    'phantom', 'vphantom', 'hphantom',
    'operatorname', 'DeclareMathOperator'
  ];

  let result = text;
  for (const cmd of commands) {
    // Match command NOT preceded by backslash, followed by { or end/space/punctuation
    // Be careful not to match inside words like "symbol" when looking for "sum"
    const regex = new RegExp(`(?<!\\\\)(?<![a-zA-Z])${cmd}(?=\\{|\\s|$|[^a-zA-Z])`, 'g');
    result = result.replace(regex, `\\${cmd}`);
  }
  return result;
};

/**
 * Wrap bare LaTeX commands in $ delimiters
 */
export const wrapBareLatex = (text: string): string => {
  if (!text) return "";

  // First fix any missing backslashes
  text = fixMissingBackslashes(text);

  const DOLLAR = String.fromCharCode(36);

  const findClosingBrace = (str: string, start: number): number => {
    let depth = 1;
    for (let i = start; i < str.length; i++) {
      if (str[i] === '{') depth++;
      else if (str[i] === '}') {
        depth--;
        if (depth === 0) return i;
      }
    }
    return -1;
  };

  const extractLatexExpr = (str: string, pos: number): string => {
    let end = pos;
    while (end < str.length && /[a-zA-Z]/.test(str[end])) end++;
    while (end < str.length) {
      if (str[end] === '_' || str[end] === '^') {
        end++;
        if (end < str.length && str[end] === '{') {
          const close = findClosingBrace(str, end + 1);
          if (close !== -1) end = close + 1;
          else break;
        } else if (end < str.length && /[a-zA-Z0-9]/.test(str[end])) {
          end++;
        }
      } else if (str[end] === '{') {
        const close = findClosingBrace(str, end + 1);
        if (close !== -1) end = close + 1;
        else break;
      } else {
        break;
      }
    }
    return str.slice(pos, end);
  };

  let result = '';
  let i = 0;
  while (i < text.length) {
    if (text[i] === DOLLAR) {
      const isDouble = text[i + 1] === DOLLAR;
      const searchStart = isDouble ? i + 2 : i + 1;
      const endDelim = isDouble ? DOLLAR + DOLLAR : DOLLAR;
      let endIdx = text.indexOf(endDelim, searchStart);
      if (endIdx === -1) endIdx = text.length;
      else endIdx += endDelim.length;
      result += text.slice(i, endIdx);
      i = endIdx;
    } else if (text[i] === '\\' && LATEX_CMD_REGEX.test(text.slice(i))) {
      const expr = extractLatexExpr(text, i + 1);
      result += DOLLAR + '\\' + expr + DOLLAR;
      i += 1 + expr.length;
    } else {
      result += text[i];
      i++;
    }
  }
  return result;
};

/**
 * Sanitize LaTeX content - fix common malformation issues
 * This runs BEFORE rendering to clean up problematic patterns
 */
export const sanitizeLatex = (text: string): string => {
  if (!text) return "";

  let result = text;

  // 0a. Remove LaTeX line breaks (\\ or \\ with spaces) outside of math mode
  // LLMs often generate "\\" as paragraph/line breaks in prose - these render as "\ \"
  // Must be done BEFORE other processing to avoid partial matches
  // Only remove \\ that are NOT inside $ delimiters (math mode)
  const mathRegions: Array<{start: number; end: number}> = [];
  let mathMatch: RegExpExecArray | null;
  const mathFinder = /\$\$[\s\S]*?\$\$|\$[^$]*\$/g;
  while ((mathMatch = mathFinder.exec(result)) !== null) {
    mathRegions.push({ start: mathMatch.index, end: mathMatch.index + mathMatch[0].length });
  }
  // Replace \\ outside math mode with a space (they're just line breaks)
  result = result.replace(/\\\\\s*/g, (match, offset) => {
    // Check if this offset is inside any math region
    for (const region of mathRegions) {
      if (offset >= region.start && offset < region.end) return match; // Keep it
    }
    return ' '; // Replace with space
  });

  // 0b. Fix \not patterns BEFORE any other processing
  // \not renders as "/" in KaTeX when malformed, convert to proper form
  // Handle both inside and outside math mode

  // First, handle proper mathematical negations - convert to forms without \not
  result = result.replace(/\\not\s*\\?empty/gi, '\\neq \\emptyset');
  result = result.replace(/\\not\s*\\?in\b/gi, '\\notin');
  result = result.replace(/\\not\s*=/g, '\\neq');
  result = result.replace(/\\not\s*\\?subset/gi, '\\nsubseteq');
  result = result.replace(/\\not\s*\\?equiv/gi, '\\not\\equiv'); // This is valid LaTeX

  // NOW: Aggressively convert ALL remaining \not patterns to plain text "not "
  // This catches cases like "\not cause", "\not the", "\not a", etc.
  // These are NOT valid LaTeX negations and would render as "/" in KaTeX
  // Use a regex that won't match inside valid LaTeX like \not\equiv
  result = result.replace(/\\not(?!\\)(?:\s+)?/g, 'not ');

  // Also catch \lnot used outside of proper math context (renders as / or ¬)
  result = result.replace(/\\lnot\s*/g, 'not ');

  // Catch any stray "/" surrounded by spaces (artifact from malformed \not rendering)
  // Normal prose rarely has " / " - this is almost always a KaTeX artifact
  // Also catch Unicode division slash (∕ U+2215)
  result = result.replace(/\s+[\/∕]\s+(?=[a-z])/gi, ' not ');
  // Also catch "/" followed by specific words that suggest negation
  result = result.replace(/\s+[\/∕]\s*(?=just|only|merely|simply)\b/gi, ' not ');

  // Fix triangle symbols appearing as raw Unicode in prose context
  // Convert to word "triangle" when followed by spaces (not in math expressions)
  result = result.replace(/[△▲▵]\s+(?=[a-z])/gi, 'triangle ');

  // Fix \square used as the word "square" (common LLM mistake)
  // \square renders as □ (geometric square symbol) but LLM often means "square" as in "square roots"
  // In technical explanations outside of $...$ math mode, □ and \square should become "square"
  // Handle ALL occurrences of □ outside math mode - replace with word "square"
  result = result.replace(/□/g, 'square');
  // Handle \square outside math mode - convert to word "square"
  // (Inside math mode it's fine as-is since KaTeX renders it properly)
  result = result.replace(/\\square(?![{])/g, 'square');

  // Fix \in used as the word "in" outside of math context
  // \in renders as ∈ (element of) symbol, but in prose should be the word "in"
  // Only convert when followed by a space and lowercase word (not valid math like \int)
  result = result.replace(/\\in(?=\s+[a-z])/gi, 'in');

  // Fix ∈ (element-of symbol) misused as the word "in" in prose
  // LLMs sometimes output ∈ when they mean "in" — e.g., "technique ∈ linear algebra"
  // In prose context (followed by a space and a lowercase letter/word), convert to "in"
  // Valid math usage like $x ∈ S$ is inside $...$ and handled separately
  result = result.replace(/∈\s+(?=[a-z])/gi, 'in ');

  // 1. Remove environment commands that appear as standalone text (not proper LaTeX)
  // These are LaTeX environments that can't be rendered inline and shouldn't appear as \command
  // We need to handle them appearing OUTSIDE of $ delimiters

  // Split by $ to process non-math regions only
  const parts = result.split(/(\$[^$]*\$)/g);
  result = parts.map((part, index) => {
    // Odd indices are inside $ delimiters (math mode) - leave them alone
    if (part.startsWith('$') && part.endsWith('$')) {
      return part;
    }

    // Even indices are outside $ delimiters - clean up orphaned LaTeX commands
    let cleaned = part;

    // Environment commands that shouldn't appear as text
    const envCommands = ['matrix', 'array', 'begin', 'end', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix', 'cases', 'aligned', 'gathered'];
    for (const cmd of envCommands) {
      // Match \command followed by space, punctuation, or word boundary (not followed by {)
      cleaned = cleaned.replace(new RegExp(`\\\\${cmd}(?![{a-zA-Z])`, 'g'), cmd);
    }

    // Accent commands used incorrectly as standalone words
    const accentCommands = ['tilde', 'hat', 'bar', 'vec', 'dot', 'ddot', 'overline', 'underline', 'check', 'acute', 'grave', 'breve', 'ring'];
    for (const cmd of accentCommands) {
      // Match \command NOT followed by { (proper usage)
      cleaned = cleaned.replace(new RegExp(`\\\\${cmd}(?![{])`, 'g'), cmd);
    }

    return cleaned;
  }).join('');

  // 2. Remove any remaining unpaired backslashes before common words
  // (These might be leftovers from failed LaTeX parsing)
  const commonWords = ['the', 'a', 'an', 'of', 'in', 'on', 'to', 'for', 'is', 'are', 'was', 'were'];
  for (const word of commonWords) {
    result = result.replace(new RegExp(`\\\\${word}\\b`, 'g'), word);
  }

  return result;
};
