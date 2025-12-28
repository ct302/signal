import { LATEX_CMD_REGEX } from '../constants';

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
    'tilde', 'widetilde', 'hat', 'widehat', 'bar', 'overline', 'underline',
    'vec', 'overrightarrow', 'overleftarrow', 'dot', 'ddot', 'dddot',
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

    // Delimiters
    'left', 'right', 'big', 'Big', 'bigg', 'Bigg',
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
    'to', 'gets', 'leadsto',

    // Matrices and environments
    'begin', 'end', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix',
    'cases', 'array', 'aligned', 'gathered',

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
