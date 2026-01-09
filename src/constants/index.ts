// API Configuration - Now dynamic via ProviderConfig
export const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434';

// No default API keys - users must provide their own for security

// OpenRouter models - hardcoded selection
export const OPENROUTER_MODELS = [
  'xiaomi/mimo-v2-flash:free',
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.3-70b-instruct:free'
];

// Fallback model chain for circuit breaker pattern
// When primary model hits rate limit, try these in order
export const OPENROUTER_FALLBACK_MODELS = [
  'xiaomi/mimo-v2-flash:free',
  'google/gemini-2.0-flash-exp:free',
  'meta-llama/llama-3.3-70b-instruct:free'
];

// Rate limit configuration
export const RATE_LIMIT_CONFIG = {
  maxRetries: 5,
  initialBackoffMs: 1000,
  maxBackoffMs: 32000,
  jitterFactor: 0.25, // ±25% jitter
  circuitBreakerThreshold: 3, // consecutive failures before trying fallback
  circuitBreakerCooldownMs: 60000, // 60s cooldown for failed model
};

// KaTeX CDN
export const KATEX_CSS = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.css";
export const KATEX_JS = "https://cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/katex.min.js";

// Stop words for text processing
export const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'because', 'as', 'what',
  'when', 'where', 'how', 'who', 'which', 'this', 'that', 'these', 'those',
  'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
  'at', 'by', 'for', 'from', 'in', 'into', 'of', 'off', 'on', 'onto',
  'out', 'over', 'to', 'up', 'with', 'about', 'against', 'between',
  'through', 'during', 'before', 'after', 'above', 'below', 'under',
  'again', 'further', 'then', 'once', 'here', 'there', 'why', 'so',
  'all', 'any', 'both', 'each', 'few', 'more', 'most', 'other', 'some',
  'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so', 'than',
  'too', 'very', 's', 't', 'can', 'will', 'just', 'don', 'should', 'now',
  'into', 'of', 'its', 'it', 'for'
]);

// LaTeX regex pattern
export const LATEX_REGEX = /(\$\$[\s\S]+?\$\$|\$[^$]+\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\\[a-zA-Z]+(?:[_^]\{[^}]*\}|\{[^}]*\})*)/g;

// LaTeX command regex for wrapping - comprehensive list including accents and dots
export const LATEX_CMD_REGEX = /\\(frac|dfrac|tfrac|lim|limsup|liminf|sum|int|iint|iiint|oint|prod|sqrt|cdot|times|div|pm|mp|leq|geq|ll|gg|neq|approx|sim|simeq|cong|equiv|propto|to|infty|partial|nabla|alpha|beta|gamma|delta|epsilon|varepsilon|zeta|eta|theta|vartheta|iota|kappa|lambda|mu|nu|xi|pi|varpi|rho|varrho|sigma|varsigma|tau|upsilon|phi|varphi|chi|psi|omega|Delta|Sigma|Omega|Gamma|Lambda|Pi|Theta|Phi|Psi|Xi|Upsilon|left|right|big|Big|bigg|Bigg|text|mathrm|mathbf|mathcal|mathbb|mathit|mathsf|boldsymbol|textbf|textrm|vec|hat|widehat|bar|overline|underline|dot|ddot|dddot|tilde|widetilde|acute|grave|breve|check|ring|overbrace|underbrace|prime|backprime|circ|bullet|star|forall|exists|nexists|subset|supset|subseteq|supseteq|cup|cap|bigcup|bigcap|in|notin|ni|land|lor|neg|lnot|implies|iff|oplus|ominus|otimes|oslash|odot|dots|ldots|cdots|vdots|ddots|quad|qquad|sin|cos|tan|cot|sec|csc|arcsin|arccos|arctan|sinh|cosh|tanh|log|ln|exp|det|dim|gcd|ker|hom|arg|deg|max|min|sup|inf|langle|rangle|lfloor|rfloor|lceil|rceil|rightarrow|leftarrow|Rightarrow|Leftarrow|leftrightarrow|Leftrightarrow|mapsto|uparrow|downarrow|Uparrow|Downarrow|nearrow|searrow|swarrow|nwarrow|hookrightarrow|hookleftarrow|parallel|perp|mid|angle|triangle|square|diamond|emptyset|varnothing|aleph|hbar|ell|wp|Re|Im|binom|tbinom|dbinom|stackrel|overset|underset|phantom|operatorname|begin|end|matrix|pmatrix|bmatrix|vmatrix|cases|array|aligned)/;

// Concept colors for isomorphic mapping
export const CONCEPT_COLORS = [
  'text-red-600', 'text-blue-600', 'text-emerald-600', 'text-purple-600',
  'text-orange-600', 'text-cyan-600', 'text-pink-600', 'text-lime-600',
  'text-indigo-600', 'text-rose-600', 'text-teal-600', 'text-amber-600'
];

export const CONCEPT_BG_COLORS = [
  'bg-red-200', 'bg-blue-200', 'bg-emerald-200', 'bg-purple-200',
  'bg-orange-200', 'bg-cyan-200', 'bg-pink-200', 'bg-lime-200',
  'bg-indigo-200', 'bg-rose-200', 'bg-teal-200', 'bg-amber-200'
];

// Quick start domains - full list (randomized subset shown to users)
export const ALL_QUICK_START_DOMAINS = [
  // Sports
  { emoji: '🏈', name: 'NFL' },
  { emoji: '🏀', name: 'NBA' },
  { emoji: '⚽', name: 'Soccer' },
  { emoji: '⚾', name: 'Baseball' },
  { emoji: '🏒', name: 'Hockey' },
  { emoji: '🎾', name: 'Tennis' },
  { emoji: '🥊', name: 'Boxing' },
  { emoji: '🏎️', name: 'Formula 1' },
  // Entertainment
  { emoji: '🎮', name: 'Video Games' },
  { emoji: '🎬', name: 'Movies' },
  { emoji: '📺', name: 'TV Shows' },
  { emoji: '🎵', name: 'Music' },
  { emoji: '🎭', name: 'Theater' },
  { emoji: '🎨', name: 'Art' },
  { emoji: '📷', name: 'Photography' },
  // Practical
  { emoji: '🍳', name: 'Cooking' },
  { emoji: '🧵', name: 'Fashion' },
  { emoji: '🏠', name: 'Home Improvement' },
  { emoji: '🌱', name: 'Gardening' },
  { emoji: '🚗', name: 'Cars' },
  // Strategy
  { emoji: '♟️', name: 'Chess' },
  { emoji: '🎲', name: 'Board Games' },
  { emoji: '🃏', name: 'Poker' },
  { emoji: '💼', name: 'Business' },
  { emoji: '💰', name: 'Investing' },
  // Outdoors
  { emoji: '⛰️', name: 'Hiking' },
  { emoji: '🎣', name: 'Fishing' },
  { emoji: '🏕️', name: 'Camping' },
  { emoji: '🏄', name: 'Surfing' },
  // Other
  { emoji: '🎸', name: 'Guitar' },
  { emoji: '🎹', name: 'Piano' },
  { emoji: '📚', name: 'Literature' },
  { emoji: '🍷', name: 'Wine' },
  { emoji: '☕', name: 'Coffee' },
  { emoji: '🐕', name: 'Dog Training' },
  { emoji: '✈️', name: 'Aviation' },
  { emoji: '🚀', name: 'Space' }
];

// Helper to get randomized subset
export const getRandomQuickStartDomains = (count: number = 5) => {
  const shuffled = [...ALL_QUICK_START_DOMAINS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
};

// Default domains (for backward compatibility)
export const QUICK_START_DOMAINS = ALL_QUICK_START_DOMAINS.slice(0, 5);

// Domain categories for proximity checking and suggestions
export const DOMAIN_CATEGORIES: Record<string, { keywords: string[]; related: Array<{ name: string; emoji: string }> }> = {
  sports: {
    keywords: ['nfl', 'football', 'nba', 'basketball', 'mlb', 'baseball', 'nhl', 'hockey', 'soccer', 'mls', 'tennis', 'golf', 'boxing', 'mma', 'ufc', 'wrestling', 'olympics', 'sports', 'athlete', 'player', 'team', 'game', 'score', 'championship', 'super bowl', 'world series', 'playoffs'],
    related: [
      { name: 'NBA', emoji: '🏀' },
      { name: 'MLB', emoji: '⚾' },
      { name: 'NHL', emoji: '🏒' },
      { name: 'Soccer', emoji: '⚽' },
      { name: 'Tennis', emoji: '🎾' }
    ]
  },
  gaming: {
    keywords: ['video games', 'gaming', 'esports', 'playstation', 'xbox', 'nintendo', 'steam', 'rpg', 'fps', 'moba', 'minecraft', 'fortnite', 'league of legends', 'valorant', 'call of duty', 'gamer', 'twitch', 'streamer'],
    related: [
      { name: 'Board Games', emoji: '🎲' },
      { name: 'Chess', emoji: '♟️' },
      { name: 'Card Games', emoji: '🃏' },
      { name: 'Movies', emoji: '🎬' },
      { name: 'Anime', emoji: '🎌' }
    ]
  },
  cooking: {
    keywords: ['cooking', 'baking', 'cuisine', 'recipe', 'chef', 'kitchen', 'food', 'restaurant', 'culinary', 'ingredients', 'meal', 'dish', 'flavor', 'gordon ramsay', 'masterchef'],
    related: [
      { name: 'Chemistry', emoji: '🧪' },
      { name: 'Gardening', emoji: '🌱' },
      { name: 'Wine', emoji: '🍷' },
      { name: 'Travel', emoji: '✈️' },
      { name: 'Art', emoji: '🎨' }
    ]
  },
  music: {
    keywords: ['music', 'song', 'album', 'band', 'artist', 'concert', 'guitar', 'piano', 'drums', 'singer', 'musician', 'spotify', 'genre', 'rock', 'pop', 'hip hop', 'jazz', 'classical', 'beethoven', 'taylor swift'],
    related: [
      { name: 'Movies', emoji: '🎬' },
      { name: 'Dance', emoji: '💃' },
      { name: 'Theater', emoji: '🎭' },
      { name: 'Poetry', emoji: '📜' },
      { name: 'Art', emoji: '🎨' }
    ]
  },
  movies: {
    keywords: ['movies', 'film', 'cinema', 'director', 'actor', 'actress', 'hollywood', 'oscar', 'screenplay', 'blockbuster', 'marvel', 'dc', 'disney', 'netflix', 'streaming'],
    related: [
      { name: 'TV Shows', emoji: '📺' },
      { name: 'Books', emoji: '📚' },
      { name: 'Theater', emoji: '🎭' },
      { name: 'Music', emoji: '🎵' },
      { name: 'Video Games', emoji: '🎮' }
    ]
  },
  chess: {
    keywords: ['chess', 'chessboard', 'grandmaster', 'magnus carlsen', 'checkmate', 'pawn', 'rook', 'bishop', 'knight', 'queen', 'king', 'opening', 'endgame', 'gambit'],
    related: [
      { name: 'Board Games', emoji: '🎲' },
      { name: 'Poker', emoji: '🃏' },
      { name: 'Go', emoji: '⚫' },
      { name: 'Strategy Games', emoji: '🎯' },
      { name: 'Mathematics', emoji: '📐' }
    ]
  },
  military: {
    keywords: ['military', 'army', 'navy', 'air force', 'marines', 'war', 'battle', 'soldier', 'general', 'strategy', 'tactics', 'weapons', 'defense'],
    related: [
      { name: 'History', emoji: '📜' },
      { name: 'Chess', emoji: '♟️' },
      { name: 'Politics', emoji: '🏛️' },
      { name: 'Engineering', emoji: '⚙️' },
      { name: 'Space', emoji: '🚀' }
    ]
  },
  nature: {
    keywords: ['nature', 'wildlife', 'animals', 'plants', 'ecosystem', 'forest', 'ocean', 'mountains', 'weather', 'climate', 'biology', 'ecology'],
    related: [
      { name: 'Gardening', emoji: '🌱' },
      { name: 'Photography', emoji: '📷' },
      { name: 'Travel', emoji: '✈️' },
      { name: 'Science', emoji: '🔬' },
      { name: 'Art', emoji: '🎨' }
    ]
  }
};

// Local storage keys
export const STORAGE_KEYS = {
  HISTORY: 'signalHistory',
  PROVIDER_CONFIG: 'signalProviderConfig'
};

// Limits
export const MAX_HISTORY_ITEMS = 50;
export const MAX_TUTOR_HISTORY = 20;

// Symbol Glossary for mathematical notation - shared across components
export interface SymbolGlossaryEntry {
  symbol: string;
  name: string;
  meaning: string;
  latex: string[];
}

export const SYMBOL_GLOSSARY: SymbolGlossaryEntry[] = [
  // Greek letters - uppercase
  { symbol: 'Σ', name: 'Sigma', meaning: 'Summation or standard deviation', latex: ['\\Sigma', '\\sum'] },
  { symbol: 'Δ', name: 'Delta', meaning: 'Change in value', latex: ['\\Delta'] },
  { symbol: 'Ω', name: 'Omega', meaning: 'Worst-case complexity or ohm', latex: ['\\Omega'] },
  { symbol: 'Θ', name: 'Theta', meaning: 'Tight bound complexity', latex: ['\\Theta'] },
  { symbol: 'Π', name: 'Pi (capital)', meaning: 'Product of sequence', latex: ['\\Pi', '\\prod'] },
  { symbol: 'Φ', name: 'Phi (capital)', meaning: 'Golden ratio or empty set', latex: ['\\Phi'] },
  { symbol: 'Ψ', name: 'Psi (capital)', meaning: 'Wave function', latex: ['\\Psi'] },
  { symbol: 'Γ', name: 'Gamma (capital)', meaning: 'Gamma function', latex: ['\\Gamma'] },
  { symbol: 'Λ', name: 'Lambda (capital)', meaning: 'Diagonal matrix', latex: ['\\Lambda'] },

  // Greek letters - lowercase
  { symbol: 'σ', name: 'sigma', meaning: 'Standard deviation', latex: ['\\sigma'] },
  { symbol: 'α', name: 'Alpha', meaning: 'First parameter or learning rate', latex: ['\\alpha'] },
  { symbol: 'β', name: 'Beta', meaning: 'Second parameter', latex: ['\\beta'] },
  { symbol: 'γ', name: 'Gamma', meaning: 'Third parameter', latex: ['\\gamma'] },
  { symbol: 'δ', name: 'Delta (small)', meaning: 'Small change', latex: ['\\delta'] },
  { symbol: 'ε', name: 'Epsilon', meaning: 'Very small quantity', latex: ['\\epsilon', '\\varepsilon'] },
  { symbol: 'θ', name: 'Theta', meaning: 'Angle or parameters', latex: ['\\theta'] },
  { symbol: 'λ', name: 'Lambda', meaning: 'Eigenvalue or rate', latex: ['\\lambda'] },
  { symbol: 'μ', name: 'Mu', meaning: 'Mean (average)', latex: ['\\mu'] },
  { symbol: 'π', name: 'Pi', meaning: '≈ 3.14159', latex: ['\\pi'] },
  { symbol: 'φ', name: 'Phi', meaning: 'Golden ratio', latex: ['\\phi', '\\varphi'] },
  { symbol: 'ψ', name: 'Psi', meaning: 'Wave function', latex: ['\\psi'] },
  { symbol: 'ω', name: 'Omega (small)', meaning: 'Angular frequency or best-case', latex: ['\\omega'] },
  { symbol: 'ρ', name: 'Rho', meaning: 'Correlation or density', latex: ['\\rho'] },
  { symbol: 'τ', name: 'Tau', meaning: 'Time constant', latex: ['\\tau'] },
  { symbol: 'η', name: 'Eta', meaning: 'Learning rate or efficiency', latex: ['\\eta'] },
  { symbol: 'κ', name: 'Kappa', meaning: 'Curvature or condition number', latex: ['\\kappa'] },
  { symbol: 'ν', name: 'Nu', meaning: 'Degrees of freedom', latex: ['\\nu'] },
  { symbol: 'χ', name: 'Chi', meaning: 'Chi-squared distribution', latex: ['\\chi'] },

  // Set theory & logic
  { symbol: '∈', name: 'Element of', meaning: '"belongs to" or "is in"', latex: ['\\in'] },
  { symbol: '∉', name: 'Not in', meaning: '"does not belong to"', latex: ['\\notin'] },
  { symbol: '⊂', name: 'Subset', meaning: 'Is contained within', latex: ['\\subset'] },
  { symbol: '⊆', name: 'Subset or equal', meaning: 'Contained or equal to', latex: ['\\subseteq'] },
  { symbol: '∪', name: 'Union', meaning: 'Combined set', latex: ['\\cup'] },
  { symbol: '∩', name: 'Intersection', meaning: 'Common elements', latex: ['\\cap'] },
  { symbol: '∀', name: 'For all', meaning: 'Applies to every element', latex: ['\\forall'] },
  { symbol: '∃', name: 'Exists', meaning: 'At least one exists', latex: ['\\exists'] },
  { symbol: '∅', name: 'Empty set', meaning: 'Set with no elements', latex: ['\\emptyset', '\\varnothing'] },
  { symbol: '∧', name: 'And', meaning: 'Logical AND', latex: ['\\land', '\\wedge'] },
  { symbol: '∨', name: 'Or', meaning: 'Logical OR', latex: ['\\lor', '\\vee'] },
  { symbol: '¬', name: 'Not', meaning: 'Logical negation', latex: ['\\neg', '\\lnot'] },

  // Calculus & analysis
  { symbol: '∞', name: 'Infinity', meaning: 'Without bound', latex: ['\\infty'] },
  { symbol: '∂', name: 'Partial', meaning: 'Partial derivative', latex: ['\\partial'] },
  { symbol: '∇', name: 'Nabla', meaning: 'Gradient operator', latex: ['\\nabla'] },
  { symbol: '∫', name: 'Integral', meaning: 'Area under curve', latex: ['\\int'] },
  { symbol: '∑', name: 'Sum', meaning: 'Summation', latex: ['\\sum'] },
  { symbol: '∏', name: 'Product', meaning: 'Product of sequence', latex: ['\\prod'] },
  { symbol: '′', name: 'Prime', meaning: 'Derivative or related variable', latex: ["'", '\\prime'] },

  // Comparisons & relations
  { symbol: '≈', name: 'Approximately', meaning: 'Roughly equal', latex: ['\\approx'] },
  { symbol: '≠', name: 'Not equal', meaning: 'Different from', latex: ['\\neq', '\\ne'] },
  { symbol: '≤', name: 'Less or equal', meaning: 'At most', latex: ['\\leq', '\\le'] },
  { symbol: '≥', name: 'Greater or equal', meaning: 'At least', latex: ['\\geq', '\\ge'] },
  { symbol: '≪', name: 'Much less', meaning: 'Significantly smaller', latex: ['\\ll'] },
  { symbol: '≫', name: 'Much greater', meaning: 'Significantly larger', latex: ['\\gg'] },
  { symbol: '∝', name: 'Proportional', meaning: 'Scales with', latex: ['\\propto'] },
  { symbol: '≡', name: 'Identical', meaning: 'Exactly equal or defined as', latex: ['\\equiv'] },

  // Arrows & implications
  { symbol: '→', name: 'Arrow', meaning: 'Maps to or approaches', latex: ['\\to', '\\rightarrow'] },
  { symbol: '←', name: 'Left arrow', meaning: 'From or assigned from', latex: ['\\leftarrow', '\\gets'] },
  { symbol: '↔', name: 'Bidirectional', meaning: 'If and only if', latex: ['\\leftrightarrow'] },
  { symbol: '⟹', name: 'Implies', meaning: 'Therefore', latex: ['\\implies', '\\Rightarrow'] },
  { symbol: '⟺', name: 'Iff', meaning: 'If and only if', latex: ['\\iff', '\\Leftrightarrow'] },

  // Arithmetic & operations
  { symbol: '√', name: 'Square root', meaning: 'Number that squares to input', latex: ['\\sqrt'] },
  { symbol: '×', name: 'Times', meaning: 'Multiplication', latex: ['\\times'] },
  { symbol: '÷', name: 'Division', meaning: 'Division', latex: ['\\div'] },
  { symbol: '±', name: 'Plus-minus', meaning: 'Positive or negative', latex: ['\\pm'] },
  { symbol: '·', name: 'Dot', meaning: 'Multiplication or dot product', latex: ['\\cdot'] },
  { symbol: '∘', name: 'Compose', meaning: 'Function composition', latex: ['\\circ'] },
  { symbol: '⊕', name: 'XOR', meaning: 'Exclusive or / direct sum', latex: ['\\oplus'] },
  { symbol: '⊗', name: 'Tensor', meaning: 'Tensor product', latex: ['\\otimes'] },

  // Big O notation specific
  { symbol: 'O', name: 'Big O', meaning: 'Upper bound (worst-case growth)', latex: ['O', '\\mathcal{O}'] },
  { symbol: 'o', name: 'Little o', meaning: 'Strictly smaller growth', latex: ['o'] },
  { symbol: 'n', name: 'n', meaning: 'Input size (number of elements)', latex: ['n'] },
  { symbol: 'log', name: 'Logarithm', meaning: 'Inverse of exponentiation', latex: ['\\log'] },
];
