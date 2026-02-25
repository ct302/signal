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
  maxRetries: 2,
  initialBackoffMs: 500,
  maxBackoffMs: 4000,
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

// Background colors with opacity - works well in both light and dark modes
export const CONCEPT_BG_COLORS = [
  'bg-red-500/20', 'bg-blue-500/20', 'bg-emerald-500/20', 'bg-purple-500/20',
  'bg-orange-500/20', 'bg-cyan-500/20', 'bg-pink-500/20', 'bg-lime-500/20',
  'bg-indigo-500/20', 'bg-rose-500/20', 'bg-teal-500/20', 'bg-amber-500/20'
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
  simple: string;  // 8 words or less, beginner-friendly
  latex: string[];
}

export const SYMBOL_GLOSSARY: SymbolGlossaryEntry[] = [
  // Greek letters - uppercase
  { symbol: 'Σ', name: 'Sigma', meaning: 'Summation or standard deviation', simple: 'Add all the numbers together', latex: ['\\Sigma', '\\sum'] },
  { symbol: 'Δ', name: 'Delta', meaning: 'Change in value', simple: 'The difference between two values', latex: ['\\Delta'] },
  { symbol: 'Ω', name: 'Omega', meaning: 'Worst-case complexity or ohm', simple: 'Slowest possible running time', latex: ['\\Omega'] },
  { symbol: 'Θ', name: 'Theta', meaning: 'Tight bound complexity', simple: 'Exact running time estimate', latex: ['\\Theta'] },
  { symbol: 'Π', name: 'Pi (capital)', meaning: 'Product of sequence', simple: 'Multiply all the numbers together', latex: ['\\Pi', '\\prod'] },
  { symbol: 'Φ', name: 'Phi (capital)', meaning: 'Golden ratio or empty set', simple: 'Special ratio found in nature', latex: ['\\Phi'] },
  { symbol: 'Ψ', name: 'Psi (capital)', meaning: 'Wave function', simple: 'Describes particle probability location', latex: ['\\Psi'] },
  { symbol: 'Γ', name: 'Gamma (capital)', meaning: 'Gamma function', simple: 'Extends factorials to all numbers', latex: ['\\Gamma'] },
  { symbol: 'Λ', name: 'Lambda (capital)', meaning: 'Diagonal matrix', simple: 'Matrix with values only on diagonal', latex: ['\\Lambda'] },

  // Greek letters - lowercase
  { symbol: 'σ', name: 'sigma', meaning: 'Standard deviation', simple: 'How spread out numbers are', latex: ['\\sigma'] },
  { symbol: 'α', name: 'Alpha', meaning: 'First parameter or learning rate', simple: 'First adjustable value', latex: ['\\alpha'] },
  { symbol: 'β', name: 'Beta', meaning: 'Second parameter', simple: 'Second adjustable value', latex: ['\\beta'] },
  { symbol: 'γ', name: 'Gamma', meaning: 'Third parameter', simple: 'Third adjustable value', latex: ['\\gamma'] },
  { symbol: 'δ', name: 'Delta (small)', meaning: 'Small change', simple: 'A tiny difference', latex: ['\\delta'] },
  { symbol: 'ε', name: 'Epsilon', meaning: 'Very small quantity', simple: 'An incredibly tiny number', latex: ['\\epsilon', '\\varepsilon'] },
  { symbol: 'θ', name: 'Theta', meaning: 'Angle or parameters', simple: 'An angle measurement', latex: ['\\theta'] },
  { symbol: 'λ', name: 'Lambda', meaning: 'Eigenvalue or rate', simple: 'A special scaling number', latex: ['\\lambda'] },
  { symbol: 'μ', name: 'Mu', meaning: 'Mean (average)', simple: 'The middle/average value', latex: ['\\mu'] },
  { symbol: 'π', name: 'Pi', meaning: '≈ 3.14159', simple: 'Circle circumference divided by diameter', latex: ['\\pi'] },
  { symbol: 'φ', name: 'Phi', meaning: 'Golden ratio', simple: 'Special ratio about 1.618', latex: ['\\phi', '\\varphi'] },
  { symbol: 'ψ', name: 'Psi', meaning: 'Wave function', simple: 'Probability of particle location', latex: ['\\psi'] },
  { symbol: 'ω', name: 'Omega (small)', meaning: 'Angular frequency or best-case', simple: 'How fast something rotates', latex: ['\\omega'] },
  { symbol: 'ρ', name: 'Rho', meaning: 'Correlation or density', simple: 'How two things relate', latex: ['\\rho'] },
  { symbol: 'τ', name: 'Tau', meaning: 'Time constant', simple: 'How fast change happens', latex: ['\\tau'] },
  { symbol: 'η', name: 'Eta', meaning: 'Learning rate or efficiency', simple: 'How quickly system learns', latex: ['\\eta'] },
  { symbol: 'κ', name: 'Kappa', meaning: 'Curvature or condition number', simple: 'How curved a line is', latex: ['\\kappa'] },
  { symbol: 'ν', name: 'Nu', meaning: 'Degrees of freedom', simple: 'Number of independent values', latex: ['\\nu'] },
  { symbol: 'χ', name: 'Chi', meaning: 'Chi-squared distribution', simple: 'Statistical test pattern', latex: ['\\chi'] },

  // Set theory & logic
  { symbol: '∈', name: 'Element of', meaning: '"belongs to" or "is in"', simple: 'Is inside the group', latex: ['\\in'] },
  { symbol: '∉', name: 'Not in', meaning: '"does not belong to"', simple: 'Is not in the group', latex: ['\\notin'] },
  { symbol: '⊂', name: 'Subset', meaning: 'Is contained within', simple: 'Smaller group inside bigger one', latex: ['\\subset'] },
  { symbol: '⊆', name: 'Subset or equal', meaning: 'Contained or equal to', simple: 'Inside or exactly the same', latex: ['\\subseteq'] },
  { symbol: '∪', name: 'Union', meaning: 'Combined set', simple: 'Everything from both groups', latex: ['\\cup'] },
  { symbol: '∩', name: 'Intersection', meaning: 'Common elements', simple: 'Only things in both groups', latex: ['\\cap'] },
  { symbol: '∀', name: 'For all', meaning: 'Applies to every element', simple: 'True for everything', latex: ['\\forall'] },
  { symbol: '∃', name: 'Exists', meaning: 'At least one exists', simple: 'At least one thing exists', latex: ['\\exists'] },
  { symbol: '∅', name: 'Empty set', meaning: 'Set with no elements', simple: 'An empty group', latex: ['\\emptyset', '\\varnothing'] },
  { symbol: '∧', name: 'And', meaning: 'Logical AND', simple: 'Both must be true', latex: ['\\land', '\\wedge'] },
  { symbol: '∨', name: 'Or', meaning: 'Logical OR', simple: 'At least one is true', latex: ['\\lor', '\\vee'] },
  { symbol: '¬', name: 'Not', meaning: 'Logical negation', simple: 'The opposite', latex: ['\\neg', '\\lnot'] },

  // Calculus & analysis
  { symbol: '∞', name: 'Infinity', meaning: 'Without bound', simple: 'Goes on forever', latex: ['\\infty'] },
  { symbol: '∂', name: 'Partial', meaning: 'Partial derivative', simple: 'Rate of change in one direction', latex: ['\\partial'] },
  { symbol: '∇', name: 'Nabla', meaning: 'Gradient operator', simple: 'Direction of steepest increase', latex: ['\\nabla'] },
  { symbol: '∫', name: 'Integral', meaning: 'Area under curve', simple: 'Find the total area', latex: ['\\int'] },
  { symbol: '∑', name: 'Sum', meaning: 'Summation', simple: 'Add all values together', latex: ['\\sum'] },
  { symbol: '∏', name: 'Product', meaning: 'Product of sequence', simple: 'Multiply all values together', latex: ['\\prod'] },

  // Comparisons & relations
  { symbol: '≈', name: 'Approximately', meaning: 'Roughly equal', simple: 'Almost the same', latex: ['\\approx'] },
  { symbol: '≠', name: 'Not equal', meaning: 'Different from', simple: 'Not the same', latex: ['\\neq', '\\ne'] },
  { symbol: '≤', name: 'Less or equal', meaning: 'At most', simple: 'Less than or equal', latex: ['\\leq', '\\le'] },
  { symbol: '≥', name: 'Greater or equal', meaning: 'At least', simple: 'Greater than or equal', latex: ['\\geq', '\\ge'] },
  { symbol: '≪', name: 'Much less', meaning: 'Significantly smaller', simple: 'Much much smaller', latex: ['\\ll'] },
  { symbol: '≫', name: 'Much greater', meaning: 'Significantly larger', simple: 'Much much bigger', latex: ['\\gg'] },
  { symbol: '∝', name: 'Proportional', meaning: 'Scales with', simple: 'Grows together proportionally', latex: ['\\propto'] },
  { symbol: '≡', name: 'Identical', meaning: 'Exactly equal or defined as', simple: 'Identical by definition', latex: ['\\equiv'] },

  // Arrows & implications
  { symbol: '→', name: 'Arrow', meaning: 'Maps to or approaches', simple: 'Goes to or becomes', latex: ['\\to', '\\rightarrow'] },
  { symbol: '←', name: 'Left arrow', meaning: 'From or assigned from', simple: 'Comes from', latex: ['\\leftarrow', '\\gets'] },
  { symbol: '↔', name: 'Bidirectional', meaning: 'If and only if', simple: 'Works both ways', latex: ['\\leftrightarrow'] },
  { symbol: '⟹', name: 'Implies', meaning: 'Therefore', simple: 'This means that', latex: ['\\implies', '\\Rightarrow'] },
  { symbol: '⟺', name: 'Iff', meaning: 'If and only if', simple: 'True both directions', latex: ['\\iff', '\\Leftrightarrow'] },

  // Arithmetic & operations
  { symbol: '√', name: 'Square root', meaning: 'Number that squares to input', simple: 'Find the root', latex: ['\\sqrt'] },
  { symbol: '×', name: 'Times', meaning: 'Multiplication', simple: 'Multiply', latex: ['\\times'] },
  { symbol: '÷', name: 'Division', meaning: 'Division', simple: 'Divide', latex: ['\\div'] },
  { symbol: '±', name: 'Plus-minus', meaning: 'Positive or negative', simple: 'Plus or minus', latex: ['\\pm'] },
  { symbol: '·', name: 'Dot', meaning: 'Multiplication or dot product', simple: 'Multiply or dot', latex: ['\\cdot'] },
  { symbol: '∘', name: 'Compose', meaning: 'Function composition', simple: 'Apply one after another', latex: ['\\circ'] },
  { symbol: '⊕', name: 'XOR', meaning: 'Exclusive or / direct sum', simple: 'One or other, not both', latex: ['\\oplus'] },
  { symbol: '⊗', name: 'Tensor', meaning: 'Tensor product', simple: 'Special matrix multiplication', latex: ['\\otimes'] },

  // Linear algebra - matrices and dimensions
  { symbol: 'U', name: 'U matrix', meaning: 'Left singular vectors (orthogonal matrix)', simple: 'Left transformation matrix', latex: ['U'] },
  { symbol: 'V', name: 'V matrix', meaning: 'Right singular vectors (orthogonal matrix)', simple: 'Right transformation matrix', latex: ['V'] },
  { symbol: 'A', name: 'Matrix A', meaning: 'Generic matrix', simple: 'A grid of numbers', latex: ['A'] },
  { symbol: 'B', name: 'Matrix B', meaning: 'Generic matrix', simple: 'Another grid of numbers', latex: ['B'] },
  { symbol: 'X', name: 'Matrix/Vector X', meaning: 'Unknown or input matrix/vector', simple: 'Unknown values to find', latex: ['X'] },
  { symbol: 'T', name: 'Transpose', meaning: 'Matrix transpose (Aᵀ)', simple: 'Flip rows and columns', latex: ['T', '^T', '^{T}'] },
  { symbol: 'm', name: 'm', meaning: 'Row dimension (number of rows)', simple: 'Number of rows', latex: ['m'] },
  { symbol: 'n', name: 'n', meaning: 'Column dimension (number of columns)', simple: 'Number of columns', latex: ['n'] },
  { symbol: 'k', name: 'k', meaning: 'Rank or iteration index', simple: 'Count or position number', latex: ['k'] },
  { symbol: 'i', name: 'i', meaning: 'Row index', simple: 'Which row', latex: ['i'] },
  { symbol: 'j', name: 'j', meaning: 'Column index', simple: 'Which column', latex: ['j'] },
];

// Concept keywords that should hint at related symbols (for Symbol Guide)
// When these terms appear in text, we show the associated symbols
export const CONCEPT_SYMBOL_HINTS: Record<string, string[]> = {
  'eigenvalue': ['λ'],
  'eigenvalues': ['λ'],
  'eigenvector': ['λ'],
  'eigenvectors': ['λ'],
  'lambda': ['λ'],
  'vector': ['→'],
  'vectors': ['→'],
  'derivative': ['∂'],
  'derivatives': ['∂'],
  'partial derivative': ['∂'],
  'partial': ['∂'],
  'integral': ['∫'],
  'integrals': ['∫'],
  'integrate': ['∫'],
  'integration': ['∫'],
  'summation': ['Σ'],
  'gradient': ['∇'],
  'divergence': ['∇'],
  'curl': ['∇'],
  'infinity': ['∞'],
  'infinite': ['∞'],
  'limit': ['∞'],
  'pi': ['π'],
  'theta': ['θ'],
  'angle': ['θ'],
  'alpha': ['α'],
  'beta': ['β'],
  'delta': ['Δ', 'δ'],
  'change': ['Δ'],
  'sigma': ['Σ', 'σ'],
  'standard deviation': ['σ'],
  'omega': ['Ω', 'ω'],
  'transpose': ['T'],
  'determinant': ['|'],
  'absolute value': ['|'],
  'subset': ['⊂'],
  'superset': ['⊃'],
  'union': ['∪'],
  'intersection': ['∩'],
  'element of': ['∈'],
  'belongs to': ['∈'],
  'not equal': ['≠'],
  'less than or equal': ['≤'],
  'greater than or equal': ['≥'],
  'approximately': ['≈'],
  'implies': ['⟹'],
  'if and only if': ['⟺'],
  'for all': ['∀'],
  'there exists': ['∃'],
};
