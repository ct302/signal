# Signal

**Learn anything through the lens of what you already know.**

Signal is an AI-powered learning platform that teaches complex technical concepts through *isomorphic analogies* — structural equivalences mapped to domains you already understand like sports, music, cooking, or games.

Instead of memorizing abstract definitions, you leverage existing mental models. Matrix decomposition becomes a football play breakdown. Neural networks become a kitchen brigade. The structure transfers, and suddenly it clicks.

---

## Features

### Core Learning Modes

| Mode | Description |
|------|-------------|
| **Morph** | Hover to smoothly transition between analogy and technical views |
| **Expert Lock** | Lock to your chosen domain's vocabulary |
| **Tech Lock** | Lock to formal technical definitions |
| **Story Mode** | Narrative explanations using your domain's language |
| **Essence Mode** | First-principles WHAT/WHY atomic insights |

### Visualization

- **Constellation View** — Interactive concept graph showing tech↔analogy mappings
- **Dual Pane** — Side-by-side comparison with structural "Why This Works" explanations
- **Heatmap Mode** — Color-gradient backgrounds showing word importance
- **Isomorphic Coloring** — Color-coded equivalent concepts across domains

### Interactive Learning

- **Quiz Me** — Adaptive difficulty with retry system and personalized feedback
- **Ask Question** — Follow-up conversations with branching history
- **Mastery Mode** — Three-stage progressive system where you prove understanding:
  - Stage 1: Pure narrative, zero jargon
  - Stage 2: Same narrative with ~6 technical terms woven in
  - Stage 3: Full narrative with all 10 terms
  - AI proctor scores your responses and extracts learning insights

### Extras

- **Symbol Guide** — Context-aware explanations for 50+ mathematical symbols
- **Definition Lookup** — Select any text for instant definitions with complexity slider
- **Intuitions** — Three memorable one-liner insights per topic
- **Study Mode** — Ambient noise (white/pink/brown) with adjustable desk lamp
- **30+ Analogy Domains** — NFL, Chess, Music Production, Cooking, Gardening, and more

---

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/ct302/signal.git
cd signal
npm install
```

### 2. Get an API Key

Get a free API key from [OpenRouter](https://openrouter.ai/keys).

### 3. Run

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000), click the gear icon, and enter your API key.

---

## How It Works

You enter a topic (e.g., "singular value decomposition") and choose a domain you know well (e.g., "NFL").

Signal generates:

1. **10 Concept Mappings** — Structural equivalences between technical terms and domain terms
2. **Attention Maps** — Word-level importance highlighting
3. **Narratives** — Stories that bridge both worlds
4. **Causal Explanations** — Why each mapping works structurally, not just thematically

Example mapping:
```
Matrix          ↔  Playbook
Rank            ↔  Offensive Depth
Decomposition   ↔  Breaking Down Film
Eigenvalue      ↔  Key Player Impact Rating
```

Each mapping includes definitions, narrative context, and structural justification.

---


### Local LLM Support

Signal supports local models via [Ollama](https://ollama.ai):

1. Install Ollama and pull a model: `ollama pull llama3`
2. In Signal settings, switch to "Local (Ollama)" provider
3. Select your model

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Icons**: Lucide React
- **Math Rendering**: KaTeX
- **LLM Integration**: OpenRouter (cloud), Ollama (local)
- **Deployment**: Vercel

---

## Architecture Highlights

- **Circuit Breaker Pattern** — Automatic fallback to alternate models on rate limits
- **Retry with Exponential Backoff** — Resilient API calls with jitter
- **Isomorphic Validation** — Filters out non-structural mappings
- **Attention-Based Rendering** — Words highlight based on conceptual importance

---

## License

MIT

---

**Signal** — Because understanding beats memorization.
