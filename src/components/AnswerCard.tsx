import { useState } from 'react';
import {
  Sparkles,
  BookOpen,
  Globe,
  Newspaper,
  Rocket,
  CloudSun,
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  AlertTriangle,
  HelpCircle,
  CornerDownRight,
} from 'lucide-react';
import type { AnswerEngineResult, SourceCategory, ConfidenceLevel } from '@/types';
import { playTapSound } from '@/lib/audio';

interface AnswerCardProps {
  result: AnswerEngineResult;
  onSelectFollowUp?: (question: string) => void;
  className?: string;
}

export function AnswerCard({ result, onSelectFollowUp, className = '' }: AnswerCardProps) {
  const [copied, setCopied] = useState(false);
  const [sourcesExpanded, setSourcesExpanded] = useState(true);

  const handleCopy = () => {
    playTapSound();
    navigator.clipboard.writeText(result.answer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getConfidenceBadge = (confidence: ConfidenceLevel, reason?: string) => {
    switch (confidence) {
      case 'verified':
        return (
          <div
            className="nexus-confidence-badge confidence-verified"
            title={reason || 'Information corroborated across multiple verified sources'}
          >
            <span className="confidence-dot verified-dot" />
            <ShieldCheck size={13} className="confidence-icon" />
            <span>Well supported</span>
          </div>
        );
      case 'limited':
        return (
          <div
            className="nexus-confidence-badge confidence-limited"
            title={reason || 'Formulated from a single source or summary'}
          >
            <span className="confidence-dot limited-dot" />
            <AlertTriangle size={13} className="confidence-icon" />
            <span>Limited sources</span>
          </div>
        );
      case 'unverified':
      default:
        return (
          <div
            className="nexus-confidence-badge confidence-unverified"
            title={reason || 'Unable to corroborate with authoritative live sources'}
          >
            <span className="confidence-dot unverified-dot" />
            <HelpCircle size={13} className="confidence-icon" />
            <span>Unable to verify</span>
          </div>
        );
    }
  };

  const getCategoryIcon = (category?: SourceCategory) => {
    switch (category) {
      case 'wikipedia':
        return <BookOpen size={13} className="source-type-icon icon-wiki" />;
      case 'nasa':
        return <Rocket size={13} className="source-type-icon icon-nasa" />;
      case 'weather':
        return <CloudSun size={13} className="source-type-icon icon-weather" />;
      case 'news':
        return <Newspaper size={13} className="source-type-icon icon-news" />;
      case 'web':
      default:
        return <Globe size={13} className="source-type-icon icon-web" />;
    }
  };

  const getCategoryLabel = (category?: SourceCategory) => {
    switch (category) {
      case 'wikipedia':
        return 'Wikipedia';
      case 'nasa':
        return 'NASA Space';
      case 'weather':
        return 'Weather';
      case 'news':
        return 'News Desk';
      case 'web':
      default:
        return 'Web';
    }
  };

  return (
    <article className={`nexus-smart-answer-card ${className}`}>
      {/* Top Beacon & Confidence Bar */}
      <div className="smart-answer-header">
        <div className="smart-answer-brand">
          <div className="nexus-ai-beacon">
            <Sparkles size={14} className="beacon-icon" />
            <span className="beacon-pulse" />
          </div>
          <span className="smart-answer-title">NEXUS SYNTHESIS</span>
          {result.model && (
            <span className="smart-answer-model-tag">{result.model}</span>
          )}
          {result.fromCache && (
            <span className="smart-answer-cached-tag">Instant Cache</span>
          )}
        </div>

        <div className="smart-answer-actions">
          {getConfidenceBadge(result.confidence, result.confidenceReason)}
          <button
            type="button"
            onClick={handleCopy}
            className="smart-answer-copy-btn"
            aria-label="Copy answer to clipboard"
            title="Copy answer"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Query Header if available */}
      {result.query && (
        <div className="smart-answer-query">
          <span className="query-label">Query:</span>
          <h3 className="query-text">"{result.query}"</h3>
        </div>
      )}

      {/* Main Synthesized Answer Text */}
      <div className="smart-answer-body">
        <p className="smart-answer-text">{result.answer}</p>
      </div>

      {/* Sources Intelligence Section */}
      {result.sources && result.sources.length > 0 && (
        <div className="smart-answer-sources-section">
          <div className="sources-header">
            <button
              type="button"
              className="sources-toggle-btn"
              onClick={() => setSourcesExpanded(!sourcesExpanded)}
            >
              <div className="sources-count-badge">
                <ShieldCheck size={13} />
                <span>
                  {result.sources.length} Verified Source{result.sources.length > 1 ? 's' : ''} Used
                </span>
              </div>
              {sourcesExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {sourcesExpanded && (
            <div className="sources-grid">
              {result.sources.map((source, index) => {
                const isWiki = source.type === 'wikipedia';
                const isNasa = source.type === 'nasa';
                const isWeather = source.type === 'weather';
                const isNews = source.type === 'news';

                return (
                  <div
                    key={`${source.url}-${index}`}
                    className={`smart-source-item ${
                      isWiki
                        ? 'source-wiki-card'
                        : isNasa
                          ? 'source-nasa-card'
                          : isWeather
                            ? 'source-weather-card'
                            : isNews
                              ? 'source-news-card'
                              : 'source-web-card'
                    }`}
                  >
                    <div className="source-item-meta">
                      <span className="source-category-tag">
                        {getCategoryIcon(source.type)}
                        <span>{getCategoryLabel(source.type)}</span>
                      </span>
                      <span className="source-domain">
                        {typeof source.domain === 'string' && source.domain ? source.domain : 'web'}
                      </span>
                    </div>

                    <div className="source-item-main">
                      {source.thumbnail && (
                        <div className="source-thumb-wrap">
                          <img
                            src={source.thumbnail}
                            alt=""
                            className="source-thumb-img"
                            referrerPolicy="no-referrer"
                            loading="lazy"
                          />
                        </div>
                      )}

                      <div className="source-info">
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="source-title-link"
                        >
                          <span className="source-title">{source.title}</span>
                          <ExternalLink size={11} className="source-arrow" />
                        </a>
                        {source.description && (
                          <p className="source-snippet">{source.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="source-item-footer">
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer"
                        className="source-link-action"
                      >
                        <span>{isWiki ? 'Read Wikipedia article' : isNasa ? 'View NASA details' : 'Open verified source'}</span>
                        <ExternalLink size={10} />
                      </a>
                      {source.date && <span className="source-date">{source.date}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Suggested Follow-up Questions */}
      {result.followUps && result.followUps.length > 0 && onSelectFollowUp && (
        <div className="smart-answer-followups">
          <div className="followups-label">
            <CornerDownRight size={13} className="followups-icon" />
            <span>Suggested follow-up questions:</span>
          </div>
          <div className="followups-chips">
            {result.followUps.map((question, idx) => (
              <button
                key={`${question}-${idx}`}
                type="button"
                className="followup-chip"
                onClick={() => {
                  playTapSound();
                  onSelectFollowUp(question);
                }}
              >
                <span>{question}</span>
                <span className="chip-arrow">→</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
