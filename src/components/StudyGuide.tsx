import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  BookOpen,
  ChevronRight,
  ChevronDown,
  Loader2,
  ClipboardCopy,
  Check,
  Layers,
  BookMarked,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import {
  StudyGuideConcept,
  StudyGuideOutline,
  StudyGuideDetail,
  StudyGuideDepth
} from '../types';
import {
  generateStudyGuideOutline,
  expandStudyGuideConcept
} from '../services';

// ============================================
// PROPS
// ============================================

interface StudyGuideProps {
  topic: string;
  domain: string;
  domainEmoji: string;
  isDarkMode: boolean;
  onClose: () => void;
  cachedOutline?: StudyGuideOutline | null;
  onOutlineGenerated?: (outline: StudyGuideOutline) => void;
}

// ============================================
// SKELETON LOADER
// ============================================

const SkeletonRow: React.FC<{ isDarkMode: boolean; width?: string }> = ({ isDarkMode, width = '100%' }) => (
  <div
    className={`h-4 rounded ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-200'} animate-pulse`}
    style={{ width }}
  />
);

const OutlineSkeleton: React.FC<{ isDarkMode: boolean; count?: number }> = ({ isDarkMode, count = 8 }) => (
  <div className="space-y-3 p-4">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className={`flex items-center gap-3 p-3 rounded-lg ${isDarkMode ? 'bg-neutral-800/50' : 'bg-neutral-50'}`}>
        <div className={`w-7 h-7 rounded-full ${isDarkMode ? 'bg-neutral-700' : 'bg-neutral-200'} animate-pulse flex-shrink-0`} />
        <div className="flex-1 space-y-2">
          <SkeletonRow isDarkMode={isDarkMode} width="60%" />
          <SkeletonRow isDarkMode={isDarkMode} width="85%" />
        </div>
      </div>
    ))}
  </div>
);

// ============================================
// CONCEPT ACCORDION ITEM
// ============================================

interface ConceptItemProps {
  concept: StudyGuideConcept;
  detail: StudyGuideDetail | null;
  isExpanded: boolean;
  isLoading: boolean;
  isDarkMode: boolean;
  domainEmoji: string;
  onToggle: () => void;
}

const ConceptItem: React.FC<ConceptItemProps> = ({
  concept,
  detail,
  isExpanded,
  isLoading,
  isDarkMode,
  domainEmoji,
  onToggle
}) => {
  return (
    <div className={`rounded-lg border transition-all ${
      isExpanded
        ? (isDarkMode ? 'border-teal-500/30 bg-neutral-800/60' : 'border-teal-300/50 bg-teal-50/30')
        : (isDarkMode ? 'border-neutral-700/50 bg-neutral-800/30 hover:border-neutral-600' : 'border-neutral-200 bg-white hover:border-neutral-300')
    }`}>
      {/* Header — always visible */}
      <button
        onClick={onToggle}
        className="w-full flex items-start gap-3 p-3 text-left cursor-pointer"
      >
        {/* Number badge */}
        <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
          isExpanded
            ? (isDarkMode ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-100 text-teal-700')
            : (isDarkMode ? 'bg-neutral-700 text-neutral-400' : 'bg-neutral-100 text-neutral-500')
        }`}>
          {concept.id}
        </span>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-semibold text-sm ${isDarkMode ? 'text-neutral-100' : 'text-neutral-800'}`}>
              {concept.tech_term}
            </span>
            <span className={`text-xs ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>→</span>
            <span className={`text-sm ${isDarkMode ? 'text-teal-400' : 'text-teal-600'}`}>
              {domainEmoji} {concept.analogy_term}
            </span>
          </div>
          <p className={`text-xs mt-1 ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'} line-clamp-2`}>
            {concept.one_liner}
          </p>
        </div>

        {/* Chevron */}
        <span className={`flex-shrink-0 mt-0.5 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
          {isLoading ? (
            <Loader2 size={16} className="animate-spin text-teal-500" />
          ) : isExpanded ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
        </span>
      </button>

      {/* Expanded detail */}
      {isExpanded && detail && (
        <div className={`px-3 pb-3 pt-0 ml-10 space-y-3 border-t ${
          isDarkMode ? 'border-neutral-700/50' : 'border-neutral-200/50'
        }`}>
          {/* Technical Explanation */}
          <div className="pt-3">
            <h4 className={`text-xs font-semibold uppercase tracking-wide mb-1 ${isDarkMode ? 'text-amber-400/80' : 'text-amber-600'}`}>
              Technical
            </h4>
            <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
              {detail.tech_explanation}
            </p>
          </div>

          {/* Domain Explanation */}
          <div>
            <h4 className={`text-xs font-semibold uppercase tracking-wide mb-1 ${isDarkMode ? 'text-teal-400/80' : 'text-teal-600'}`}>
              {domainEmoji} Through Your Lens
            </h4>
            <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
              {detail.analogy_explanation}
            </p>
          </div>

          {/* Why It Maps */}
          <div>
            <h4 className={`text-xs font-semibold uppercase tracking-wide mb-1 ${isDarkMode ? 'text-purple-400/80' : 'text-purple-600'}`}>
              Why This Maps
            </h4>
            <p className={`text-sm leading-relaxed ${isDarkMode ? 'text-neutral-300' : 'text-neutral-600'}`}>
              {detail.why_it_maps}
            </p>
          </div>

          {/* Key Insight */}
          <div className={`p-2.5 rounded-lg ${isDarkMode ? 'bg-yellow-900/20 border border-yellow-500/20' : 'bg-yellow-50 border border-yellow-200'}`}>
            <p className={`text-sm font-medium italic ${isDarkMode ? 'text-yellow-300' : 'text-yellow-700'}`}>
              💡 {detail.key_insight}
            </p>
          </div>
        </div>
      )}

      {/* Loading state for expansion */}
      {isExpanded && !detail && isLoading && (
        <div className="px-3 pb-3 ml-10 space-y-2 pt-3">
          <SkeletonRow isDarkMode={isDarkMode} width="40%" />
          <SkeletonRow isDarkMode={isDarkMode} />
          <SkeletonRow isDarkMode={isDarkMode} width="90%" />
          <SkeletonRow isDarkMode={isDarkMode} width="40%" />
          <SkeletonRow isDarkMode={isDarkMode} />
          <SkeletonRow isDarkMode={isDarkMode} width="70%" />
        </div>
      )}
    </div>
  );
};

// ============================================
// MAIN STUDY GUIDE COMPONENT
// ============================================

export const StudyGuide: React.FC<StudyGuideProps> = ({
  topic,
  domain,
  domainEmoji,
  isDarkMode,
  onClose,
  cachedOutline,
  onOutlineGenerated
}) => {
  // State
  const [depth, setDepth] = useState<StudyGuideDepth>('core');
  const [outline, setOutline] = useState<StudyGuideOutline | null>(cachedOutline || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Expansion state
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [details, setDetails] = useState<Map<number, StudyGuideDetail>>(new Map());
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());

  // Copy feedback
  const [copied, setCopied] = useState(false);

  // Generate outline on mount if not cached
  const generateOutline = useCallback(async (selectedDepth: StudyGuideDepth) => {
    setIsGenerating(true);
    setError(null);
    setOutline(null);
    setExpandedIds(new Set());
    setDetails(new Map());

    try {
      const result = await generateStudyGuideOutline(topic, domain, selectedDepth);
      if (result) {
        setOutline(result);
        onOutlineGenerated?.(result);
      } else {
        setError('Failed to generate study guide. Please try again.');
      }
    } catch (err: any) {
      const message = err?.message || 'Something went wrong generating the study guide.';
      // Check for free tier exhaustion
      if (message.includes('free searches') || err?.code === 'FREE_TIER_EXHAUSTED') {
        setError('You\'ve used all your free searches for today. Add your API key in Settings for unlimited access!');
      } else {
        setError(message);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [topic, domain, onOutlineGenerated]);

  // Auto-generate if no cached outline
  useEffect(() => {
    if (!cachedOutline) {
      // Don't auto-generate — wait for user to pick depth and click generate
    }
  }, [cachedOutline]);

  // Toggle a concept's expansion
  const toggleConcept = useCallback(async (concept: StudyGuideConcept) => {
    const id = concept.id;

    if (expandedIds.has(id)) {
      // Collapse
      setExpandedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }

    // Expand
    setExpandedIds(prev => new Set(prev).add(id));

    // If we already have the detail, don't re-fetch
    if (details.has(id)) return;

    // Fetch detail
    setLoadingIds(prev => new Set(prev).add(id));
    try {
      const detail = await expandStudyGuideConcept(concept, topic, domain);
      if (detail) {
        setDetails(prev => new Map(prev).set(id, detail));
      }
    } catch (err: any) {
      console.error(`Failed to expand concept ${id}:`, err);
      // Don't collapse — just show the one-liner
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }, [expandedIds, details, topic, domain]);

  // Format as Markdown for export
  const formatAsMarkdown = useCallback((): string => {
    if (!outline) return '';

    const lines: string[] = [
      `# ${outline.topic} — Study Guide`,
      `*Through the lens of: ${outline.domain}* ${domainEmoji}`,
      `*Depth: ${outline.depth === 'core' ? 'Core Concepts' : 'Complete Guide'} (${outline.concepts.length} concepts)*`,
      ''
    ];

    let currentCategory = '';

    for (const concept of outline.concepts) {
      // Category header for complete guides
      if (concept.category && concept.category !== currentCategory) {
        currentCategory = concept.category;
        lines.push(`## ${currentCategory}`, '');
      }

      lines.push(`### ${concept.id}. ${concept.tech_term} → ${concept.analogy_term}`);
      lines.push(`> ${concept.one_liner}`);
      lines.push('');

      // If we have expanded detail, include it
      const detail = details.get(concept.id);
      if (detail) {
        lines.push(`**Technical**: ${detail.tech_explanation}`);
        lines.push('');
        lines.push(`**Through Your Lens**: ${detail.analogy_explanation}`);
        lines.push('');
        lines.push(`**Why This Maps**: ${detail.why_it_maps}`);
        lines.push('');
        lines.push(`**💡 Key Insight**: "${detail.key_insight}"`);
        lines.push('');
      }

      lines.push('---', '');
    }

    lines.push(`*Generated by Signal Analogy Engine on ${new Date().toLocaleDateString()}*`);
    return lines.join('\n');
  }, [outline, details, domainEmoji]);

  // Copy to clipboard
  const copyToClipboard = useCallback(() => {
    const markdown = formatAsMarkdown();
    if (!markdown) return;

    const textarea = document.createElement('textarea');
    textarea.value = markdown;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
    document.body.removeChild(textarea);
  }, [formatAsMarkdown]);

  // Group concepts by category (for complete guides)
  const groupedConcepts = outline?.concepts ? (() => {
    if (outline.depth === 'core' || !outline.concepts.some(c => c.category)) {
      return [{ category: null, concepts: outline.concepts }];
    }
    const groups: { category: string | null; concepts: StudyGuideConcept[] }[] = [];
    let currentCat = '';
    for (const concept of outline.concepts) {
      if (concept.category && concept.category !== currentCat) {
        currentCat = concept.category;
        groups.push({ category: currentCat, concepts: [] });
      }
      if (groups.length === 0) groups.push({ category: null, concepts: [] });
      groups[groups.length - 1].concepts.push(concept);
    }
    return groups;
  })() : [];

  // ============================================
  // RENDER
  // ============================================

  return (
    <div className={`rounded-xl border shadow-lg overflow-hidden ${
      isDarkMode ? 'bg-neutral-900 border-neutral-700' : 'bg-white border-neutral-200'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${
        isDarkMode ? 'bg-neutral-800/50 border-neutral-700' : 'bg-teal-50/50 border-neutral-200'
      }`}>
        <div className="flex items-center gap-2">
          <BookOpen size={18} className={isDarkMode ? 'text-teal-400' : 'text-teal-600'} />
          <h2 className={`font-semibold text-sm ${isDarkMode ? 'text-neutral-100' : 'text-neutral-800'}`}>
            Study Guide
          </h2>
          {outline && (
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              isDarkMode ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-100 text-teal-600'
            }`}>
              {outline.concepts.length} concepts
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Copy as Markdown */}
          {outline && (
            <button
              onClick={copyToClipboard}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                copied
                  ? (isDarkMode ? 'bg-green-500/20 text-green-300' : 'bg-green-100 text-green-700')
                  : (isDarkMode ? 'bg-neutral-700 text-neutral-300 hover:bg-neutral-600' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200')
              }`}
              title="Copy as Markdown for Obsidian / Notion"
            >
              {copied ? <Check size={14} /> : <ClipboardCopy size={14} />}
              <span>{copied ? 'Copied!' : 'Copy MD'}</span>
            </button>
          )}
          {/* Close */}
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg transition-colors ${
              isDarkMode ? 'text-neutral-400 hover:bg-neutral-700' : 'text-neutral-500 hover:bg-neutral-100'
            }`}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="max-h-[70vh] overflow-y-auto">
        {/* Depth Selector — shown when no outline yet */}
        {!outline && !isGenerating && !error && (
          <div className="p-6 space-y-4">
            <p className={`text-sm text-center ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
              Decompose <strong className={isDarkMode ? 'text-neutral-200' : 'text-neutral-700'}>{topic}</strong> through the lens of{' '}
              <strong className={isDarkMode ? 'text-teal-400' : 'text-teal-600'}>{domainEmoji} {domain}</strong>
            </p>

            <div className="flex gap-3 justify-center">
              {/* Core Concepts */}
              <button
                onClick={() => setDepth('core')}
                className={`flex-1 max-w-[200px] p-3 rounded-xl border-2 transition-all text-left ${
                  depth === 'core'
                    ? (isDarkMode ? 'border-teal-500 bg-teal-500/10' : 'border-teal-400 bg-teal-50')
                    : (isDarkMode ? 'border-neutral-700 bg-neutral-800/50 hover:border-neutral-600' : 'border-neutral-200 hover:border-neutral-300')
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <Layers size={16} className={depth === 'core' ? (isDarkMode ? 'text-teal-400' : 'text-teal-600') : (isDarkMode ? 'text-neutral-500' : 'text-neutral-400')} />
                  <span className={`font-semibold text-sm ${isDarkMode ? 'text-neutral-100' : 'text-neutral-800'}`}>Core Concepts</span>
                </div>
                <p className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>8-10 essential ideas</p>
              </button>

              {/* Complete Guide */}
              <button
                onClick={() => setDepth('complete')}
                className={`flex-1 max-w-[200px] p-3 rounded-xl border-2 transition-all text-left ${
                  depth === 'complete'
                    ? (isDarkMode ? 'border-teal-500 bg-teal-500/10' : 'border-teal-400 bg-teal-50')
                    : (isDarkMode ? 'border-neutral-700 bg-neutral-800/50 hover:border-neutral-600' : 'border-neutral-200 hover:border-neutral-300')
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <BookMarked size={16} className={depth === 'complete' ? (isDarkMode ? 'text-teal-400' : 'text-teal-600') : (isDarkMode ? 'text-neutral-500' : 'text-neutral-400')} />
                  <span className={`font-semibold text-sm ${isDarkMode ? 'text-neutral-100' : 'text-neutral-800'}`}>Complete Guide</span>
                </div>
                <p className={`text-xs ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>30+ detailed concepts</p>
              </button>
            </div>

            <div className="flex justify-center">
              <button
                onClick={() => generateOutline(depth)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                  isDarkMode
                    ? 'bg-teal-600 text-white hover:bg-teal-500 shadow-lg shadow-teal-500/20'
                    : 'bg-teal-500 text-white hover:bg-teal-600 shadow-lg shadow-teal-500/20'
                }`}
              >
                <Sparkles size={16} />
                Generate Study Guide
              </button>
            </div>

            <p className={`text-xs text-center ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
              Counts as 1 search • Expand sections on-demand
            </p>
          </div>
        )}

        {/* Loading State */}
        {isGenerating && (
          <div>
            <div className="flex items-center justify-center gap-2 p-4">
              <Loader2 size={16} className="animate-spin text-teal-500" />
              <span className={`text-sm ${isDarkMode ? 'text-neutral-400' : 'text-neutral-500'}`}>
                Decomposing {topic} through {domainEmoji} {domain}...
              </span>
            </div>
            <OutlineSkeleton isDarkMode={isDarkMode} count={depth === 'core' ? 8 : 15} />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="p-6 space-y-3 text-center">
            <AlertCircle size={24} className={isDarkMode ? 'text-red-400 mx-auto' : 'text-red-500 mx-auto'} />
            <p className={`text-sm ${isDarkMode ? 'text-red-300' : 'text-red-600'}`}>{error}</p>
            <button
              onClick={() => generateOutline(depth)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isDarkMode ? 'bg-neutral-700 text-neutral-200 hover:bg-neutral-600' : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
              }`}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Concept List */}
        {outline && !isGenerating && (
          <div className="p-3 space-y-2">
            {groupedConcepts.map((group, gi) => (
              <div key={gi}>
                {/* Category Header */}
                {group.category && (
                  <h3 className={`text-xs font-bold uppercase tracking-wider px-2 pt-3 pb-1 ${
                    isDarkMode ? 'text-teal-400/70' : 'text-teal-600/70'
                  }`}>
                    {group.category}
                  </h3>
                )}
                {/* Concepts in this group */}
                <div className="space-y-2">
                  {group.concepts.map(concept => (
                    <ConceptItem
                      key={concept.id}
                      concept={concept}
                      detail={details.get(concept.id) || null}
                      isExpanded={expandedIds.has(concept.id)}
                      isLoading={loadingIds.has(concept.id)}
                      isDarkMode={isDarkMode}
                      domainEmoji={domainEmoji}
                      onToggle={() => toggleConcept(concept)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {/* Footer hint */}
            <p className={`text-xs text-center py-2 ${isDarkMode ? 'text-neutral-500' : 'text-neutral-400'}`}>
              Click any concept to expand • Each expansion uses 1 search
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
