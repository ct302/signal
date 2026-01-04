import React from 'react';

/**
 * Renders text that may contain LaTeX notation ($...$) using KaTeX.
 * Falls back to displaying raw text if KaTeX is not loaded.
 *
 * @param text - The text potentially containing LaTeX (e.g., "Rank-$k$ approximation")
 * @param isKatexLoaded - Whether KaTeX has been loaded
 * @returns React nodes with rendered LaTeX
 */
export const renderLatex = (text: string | undefined, isKatexLoaded: boolean): React.ReactNode => {
  if (!text) return null;

  // If KaTeX isn't loaded, return text as-is
  if (!isKatexLoaded || !window.katex) {
    return text;
  }

  // Split text by $...$ patterns (single $ for inline math)
  // This regex captures the delimiters to identify LaTeX portions
  const parts = text.split(/(\$[^$]+\$)/g);

  if (parts.length === 1) {
    // No LaTeX found, return as-is
    return text;
  }

  return (
    <>
      {parts.map((part, index) => {
        if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
          // This is a LaTeX portion - extract content between $ signs
          const latex = part.slice(1, -1);
          try {
            const html = window.katex!.renderToString(latex, {
              throwOnError: false,
              displayMode: false, // Inline mode
            });
            return (
              <span
                key={index}
                dangerouslySetInnerHTML={{ __html: html }}
                className="latex-inline"
              />
            );
          } catch (e) {
            // If KaTeX fails to parse, return the original text
            console.warn('KaTeX render error:', e);
            return <span key={index}>{part}</span>;
          }
        }
        // Regular text
        return part ? <span key={index}>{part}</span> : null;
      })}
    </>
  );
};

/**
 * Component wrapper for rendering LaTeX text.
 * Useful when you need to render LaTeX within JSX.
 */
export const LaTeXText: React.FC<{
  text: string | undefined;
  isKatexLoaded: boolean;
  className?: string;
}> = ({ text, isKatexLoaded, className }) => {
  return (
    <span className={className}>
      {renderLatex(text, isKatexLoaded)}
    </span>
  );
};
