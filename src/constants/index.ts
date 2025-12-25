// API Configuration - Now dynamic via ProviderConfig
export const DEFAULT_OLLAMA_ENDPOINT = 'http://localhost:11434';

// Default API key for demo purposes (users can override in Settings)
export const DEFAULT_GEMINI_API_KEY = 'AIzaSyBE0wJnhKSiQlIbkr2yfrR9mpaQdfoCKZM';

// OpenRouter API key for LLAMA 3.3 70B (demo/testing)
export const DEFAULT_OPENROUTER_API_KEY = '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';

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

// LaTeX command regex for wrapping
export const LATEX_CMD_REGEX = /\\(frac|lim|sum|int|prod|sqrt|cdot|times|div|pm|mp|leq|geq|neq|approx|equiv|to|infty|partial|nabla|alpha|beta|gamma|delta|epsilon|theta|lambda|mu|pi|sigma|omega|phi|psi|rho|tau|eta|nu|xi|Delta|Sigma|Omega|Gamma|Lambda|Pi|Theta|Phi|Psi|left|right|text|mathrm|mathbf|mathcal|mathbb|boldsymbol|textbf|vec|hat|bar|dot|ddot|tilde|prime|circ|bullet|star|forall|exists|subset|supset|cup|cap|in|notin|land|lor|neg|implies|iff|oplus|otimes|odot)/;

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

// Quick start domains
export const QUICK_START_DOMAINS = [
  { emoji: '🏈', name: 'NFL' },
  { emoji: '🎮', name: 'Video Games' },
  { emoji: '🍳', name: 'Cooking' },
  { emoji: '🎵', name: 'Music' },
  { emoji: '🎬', name: 'Movies' }
];

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
