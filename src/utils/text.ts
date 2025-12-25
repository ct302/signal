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
 */
const fixMissingBackslashes = (text: string): string => {
  // List of common LaTeX commands that might appear without backslash
  const commands = [
    'mathbf', 'mathrm', 'mathcal', 'mathbb', 'mathit', 'textbf', 'textrm',
    'frac', 'sqrt', 'sum', 'prod', 'int', 'lim',
    'cdot', 'times', 'div', 'pm', 'approx', 'neq', 'leq', 'geq',
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'theta', 'lambda', 'mu', 'pi', 'sigma', 'omega',
    'infty', 'partial', 'nabla',
    'sin', 'cos', 'tan', 'log', 'ln', 'exp',
    'rightarrow', 'leftarrow', 'Rightarrow', 'Leftarrow'
  ];

  let result = text;
  for (const cmd of commands) {
    // Match command NOT preceded by backslash, followed by { or end/space
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
