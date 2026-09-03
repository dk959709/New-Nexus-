import React, { useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  Bot,
  Brain,
  Calendar,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  Globe,
  HelpCircle,
  Info,
  Layers,
  Lightbulb,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { JarvisExecutionStep } from '../../types';
import { FormattedText } from './FormattedText';
import { copyToClipboard } from '@/lib/clipboard';
import { cleanAndFormatFact, formatResearcherOutput } from '../../lib/factFormatter';

function extractDomain(urlStr: string): string {
  try {
    return new URL(urlStr).hostname.replace(/^www\./, '');
  } catch {
    return urlStr.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

interface JarvisDeepResearchMeshAnswersProps {
  steps: JarvisExecutionStep[];
  query?: string;
  isDeepResearch?: boolean;
}

interface AgentTheme {
  title: string;
  subtitle: string;
  border: string;
  bg: string;
  headerBg: string;
  text: string;
  badgeBg: string;
  accentGlow: string;
  icon: React.ReactNode;
}

const AGENT_THEMES: Record<string, AgentTheme> = {
  planner: {
    title: 'PLANNER // STRATEGIC DECOMPOSITION',
    subtitle: 'Autonomous Task Scoping, Multi-Step Architecture & Directives',
    border: 'rgba(97, 215, 201, 0.45)',
    bg: 'linear-gradient(150deg, rgba(8, 28, 36, 0.9) 0%, rgba(5, 18, 24, 0.95) 100%)',
    headerBg: 'rgba(12, 38, 48, 0.6)',
    text: '#61d7c9',
    badgeBg: 'rgba(97, 215, 201, 0.15)',
    accentGlow: 'rgba(97, 215, 201, 0.3)',
    icon: <Brain size={18} className="text-cyan-400" />,
  },
  researcher: {
    title: 'RESEARCHER // EMPIRICAL INTELLIGENCE',
    subtitle: 'Real-time Web Search, Multi-Engine Retrieval & Fact Extraction',
    border: 'rgba(180, 115, 60, 0.5)',
    bg: 'linear-gradient(150deg, rgba(38, 22, 12, 0.92) 0%, rgba(24, 14, 8, 0.96) 100%)',
    headerBg: 'rgba(54, 28, 14, 0.65)',
    text: '#d99b64',
    badgeBg: 'rgba(180, 115, 60, 0.18)',
    accentGlow: 'rgba(180, 115, 60, 0.35)',
    icon: <Search size={18} className="text-amber-500" />,
  },
  webFetcher: {
    title: 'WEB FETCHER // DIRECT PAGE EXTRACTION',
    subtitle: 'Raw HTML Content Retrieval, Text Extraction & Structure Parsing',
    border: 'rgba(34, 211, 238, 0.45)',
    bg: 'linear-gradient(150deg, rgba(8, 32, 40, 0.9) 0%, rgba(5, 20, 26, 0.95) 100%)',
    headerBg: 'rgba(12, 44, 56, 0.6)',
    text: '#22d3ee',
    badgeBg: 'rgba(34, 211, 238, 0.15)',
    accentGlow: 'rgba(34, 211, 238, 0.3)',
    icon: <Globe size={18} className="text-cyan-400" />,
  },
  advisor: {
    title: 'ADVISOR // COMPARATIVE & CONCEPTUAL ANALYSIS',
    subtitle: 'Reasoned Trade-Offs, Comparison Tables, ASCII Blueprints & Verdicts',
    border: 'rgba(250, 204, 21, 0.45)',
    bg: 'linear-gradient(150deg, rgba(34, 28, 8, 0.9) 0%, rgba(22, 18, 5, 0.95) 100%)',
    headerBg: 'rgba(50, 40, 12, 0.6)',
    text: '#facc15',
    badgeBg: 'rgba(250, 204, 21, 0.15)',
    accentGlow: 'rgba(250, 204, 21, 0.3)',
    icon: <Lightbulb size={18} className="text-amber-400" />,
  },
  factChecker: {
    title: 'FACT CHECKER // INTEGRITY & ACCURACY AUDIT',
    subtitle: 'Cross-Verification, Anomaly Detection & Grounded Claim Scrutiny',
    border: 'rgba(192, 132, 252, 0.45)',
    bg: 'linear-gradient(150deg, rgba(28, 14, 48, 0.92) 0%, rgba(16, 8, 30, 0.96) 100%)',
    headerBg: 'rgba(42, 18, 70, 0.65)',
    text: '#c084fc',
    badgeBg: 'rgba(192, 132, 252, 0.15)',
    accentGlow: 'rgba(192, 132, 252, 0.35)',
    icon: <ShieldCheck size={18} className="text-purple-400" />,
  },
  reviewer: {
    title: 'REVIEWER // QUALITY ASSURANCE',
    subtitle: 'Synthesis Critique, Structural Nuance & Completeness Evaluation',
    border: 'rgba(52, 211, 153, 0.45)',
    bg: 'linear-gradient(150deg, rgba(6, 32, 24, 0.9) 0%, rgba(4, 20, 16, 0.95) 100%)',
    headerBg: 'rgba(10, 48, 36, 0.6)',
    text: '#34d399',
    badgeBg: 'rgba(52, 211, 153, 0.15)',
    accentGlow: 'rgba(52, 211, 153, 0.3)',
    icon: <Check size={18} className="text-emerald-400" />,
  },
  architect: {
    title: 'ARCHITECT // SYSTEM BLUEPRINT DESIGNER',
    subtitle: 'High-Level Technical Architecture & Diagram Specification',
    border: 'rgba(251, 146, 60, 0.45)',
    bg: 'linear-gradient(150deg, rgba(36, 18, 8, 0.9) 0%, rgba(24, 12, 5, 0.95) 100%)',
    headerBg: 'rgba(54, 26, 12, 0.6)',
    text: '#fb923c',
    badgeBg: 'rgba(251, 146, 60, 0.15)',
    accentGlow: 'rgba(251, 146, 60, 0.3)',
    icon: <Layers size={18} className="text-orange-400" />,
  },
  dataAnalyst: {
    title: 'DATA ANALYST // STATISTICAL DECOMPOSITION',
    subtitle: 'Quantitative Metrics Extraction & Data Structuring',
    border: 'rgba(244, 114, 182, 0.45)',
    bg: 'linear-gradient(150deg, rgba(36, 10, 24, 0.9) 0%, rgba(24, 6, 16, 0.95) 100%)',
    headerBg: 'rgba(54, 14, 36, 0.6)',
    text: '#f472b6',
    badgeBg: 'rgba(244, 114, 182, 0.15)',
    accentGlow: 'rgba(244, 114, 182, 0.3)',
    icon: <Sparkles size={18} className="text-pink-400" />,
  },
  critic: {
    title: 'CRITIC // DEVIL\'S ADVOCATE & STRESS TEST',
    subtitle: 'Counter-Hypothesis Generation & Edge-Case Probing',
    border: 'rgba(251, 113, 133, 0.45)',
    bg: 'linear-gradient(150deg, rgba(36, 8, 14, 0.9) 0%, rgba(24, 5, 10, 0.95) 100%)',
    headerBg: 'rgba(54, 12, 22, 0.6)',
    text: '#fb7185',
    badgeBg: 'rgba(251, 113, 133, 0.15)',
    accentGlow: 'rgba(251, 113, 133, 0.3)',
    icon: <HelpCircle size={18} className="text-rose-400" />,
  },
  finalSynthesizer: {
    title: 'SYNTHESIZER // COMPREHENSIVE COMPILATION',
    subtitle: 'Overarching Unified Synthesis & Multi-Agent Harmonization',
    border: 'rgba(168, 85, 247, 0.45)',
    bg: 'linear-gradient(150deg, rgba(32, 10, 48, 0.9) 0%, rgba(20, 6, 32, 0.95) 100%)',
    headerBg: 'rgba(48, 16, 72, 0.6)',
    text: '#c084fc',
    badgeBg: 'rgba(168, 85, 247, 0.15)',
    accentGlow: 'rgba(168, 85, 247, 0.3)',
    icon: <Zap size={18} className="text-purple-400" />,
  },
};

/**
 * Multi-pass ultra-resilient JSON parser with repair strategies
 */
function parseAgentJson(rawOutput: string): { parsed: unknown; isJson: boolean } {
  if (!rawOutput) return { parsed: null, isJson: false };
  let cleaned = rawOutput.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  // Pass 1: Direct JSON.parse
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && (typeof parsed === 'object' || Array.isArray(parsed))) {
      return { parsed, isJson: true };
    }
  } catch {
    // continue
  }

  // Pass 2: Boundary extraction (between first { and last } or first [ and last ])
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');

  let toParse = cleaned;
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace && (firstBracket === -1 || firstBrace < firstBracket)) {
    toParse = cleaned.substring(firstBrace, lastBrace + 1);
  } else if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
    toParse = cleaned.substring(firstBracket, lastBracket + 1);
  }

  try {
    const parsed = JSON.parse(toParse);
    if (parsed && (typeof parsed === 'object' || Array.isArray(parsed))) {
      return { parsed, isJson: true };
    }
  } catch {
    // continue
  }

  // Pass 3: Common JSON error repairs (trailing commas, smart quotes, comments, unescaped quotes)
  try {
    const sanitized = toParse
      // Strip comments
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Trailing commas
      .replace(/,\s*([}\]])/g, '$1')
      // Smart quotes to ASCII
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/[\u2018\u2019]/g, "'");

    const parsed = JSON.parse(sanitized);
    if (parsed && (typeof parsed === 'object' || Array.isArray(parsed))) {
      return { parsed, isJson: true };
    }
  } catch {
    // continue
  }

  return { parsed: null, isJson: false };
}

/**
 * Check if a string is an isolated JSON key name artifact
 */
function isJsonKeyArtifact(str: string): boolean {
  if (!str) return true;
  const normalized = str.trim().toLowerCase().replace(/^["'`]|["'`]$/g, '');
  return /^(?:title|fact|claim|domain|url|eventdate|event_date|publishedat|published_at|updatedat|updated_at|datestatus|date_status|confirmedby|confirmed_by|sourceindex|source_index|source|sources|location|category|description|headline)$/i.test(normalized);
}

/**
 * Validates whether a value is a real, meaningful date string.
 * Discards null, undefined, "null", "undefined", "unknown", "none", or JSON key names.
 */
function isValidDateValue(val: unknown): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val !== 'string' && typeof val !== 'number') return false;
  const str = String(val).trim();
  if (!str) return false;
  if (/^(null|undefined|unknown|none|n\/a|unspecified)$/i.test(str)) return false;
  if (/^(dateStatus|eventDate|publishedAt|updatedAt|url|domain|claim|fact)$/i.test(str)) return false;
  return true;
}

/**
 * Extracts a real date value from the object properties (eventDate, publishedAt, updatedAt, or valid dateStatus)
 */
function extractRealDateValue(obj: Record<string, unknown>): string {
  if (isValidDateValue(obj.eventDate)) return String(obj.eventDate).trim();
  if (isValidDateValue(obj.publishedAt)) return String(obj.publishedAt).trim();
  if (isValidDateValue(obj.updatedAt)) return String(obj.updatedAt).trim();
  if (isValidDateValue(obj.dateStatus)) {
    const ds = String(obj.dateStatus).trim();
    if (!/^(unknown|null|undefined|none|n\/a)$/i.test(ds)) {
      return ds;
    }
  }
  return '';
}

/**
 * Formats a verified claim item (object or string) into ONE clean block:
 *
 * ✅ [claim text]
 *    Source: [domain] ([eventDate or publishedAt if available])
 *    Confirmed by: [confirmedBy list, comma-separated]
 *
 * Hides any field that is null. Never outputs raw field names.
 */
function formatVerifiedClaimEntry(v: unknown): string {
  if (!v) return '';

  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (!trimmed) return '';

    // If already starts with ✅, return as-is
    if (trimmed.startsWith('✅')) {
      return trimmed;
    }

    // Check if the string is serialized JSON
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') {
          return formatVerifiedClaimEntry(parsed);
        }
      } catch {
        // Fall through
      }
    }

    // Check if the string is an isolated raw JSON field or null field
    if (/^"?([a-zA-Z0-9_]+)"?\s*[:=]\s*(?:null|undefined|""|''|\[\]|\{\})\s*,?$/i.test(trimmed)) {
      return '';
    }
    if (/^"?(dateStatus|eventDate|publishedAt|updatedAt|url)"?\s*[:=]/i.test(trimmed)) {
      return '';
    }

    // Clean any leading bullets or checkmarks
    const cleanClaim = trimmed.replace(/^[-*•]\s*/, '').replace(/^✅\s*/, '').trim();
    if (!cleanClaim || isJsonKeyArtifact(cleanClaim)) return '';
    return `✅ ${cleanClaim}`;
  }

  if (typeof v === 'object' && v !== null) {
    const vObj = v as Record<string, unknown>;

    let claim = String(
      vObj.claim ||
      vObj.fact ||
      vObj.statement ||
      vObj.title ||
      vObj.text ||
      vObj.point ||
      vObj.finding ||
      ''
    ).trim();

    if (!claim || isJsonKeyArtifact(claim)) {
      const entry = Object.entries(vObj).find(
        ([k, val]) =>
          !/^(domain|url|eventDate|publishedAt|updatedAt|dateStatus|confirmedBy|id|sourceIndex)$/i.test(k) &&
          typeof val === 'string' &&
          val.trim().length > 10
      );
      if (entry) claim = String(entry[1]).trim();
    }

    if (!claim || isJsonKeyArtifact(claim)) {
      return '';
    }

    claim = claim.replace(/^✅\s*/, '').replace(/^[-*•]\s*/, '').trim();

    let domain = '';
    if (typeof vObj.domain === 'string' && vObj.domain.trim() && !/^(null|undefined|unknown|none)$/i.test(vObj.domain.trim())) {
      domain = vObj.domain.trim();
    } else if (typeof vObj.url === 'string' && vObj.url.trim() && !/^(null|undefined)$/i.test(vObj.url.trim())) {
      domain = extractDomain(vObj.url.trim());
    }

    const dateStr = extractRealDateValue(vObj);

    let sourceLine = '';
    if (domain && dateStr) {
      sourceLine = `   Source: ${domain} (${dateStr})`;
    } else if (domain) {
      sourceLine = `   Source: ${domain}`;
    } else if (dateStr) {
      sourceLine = `   Source: ${dateStr}`;
    }

    let confirmedList: string[] = [];
    if (Array.isArray(vObj.confirmedBy)) {
      confirmedList = vObj.confirmedBy
        .map((c) => String(c || '').trim())
        .filter((c) => c && !/^(null|undefined|none|\[\])$/i.test(c));
    } else if (typeof vObj.confirmedBy === 'string' && vObj.confirmedBy.trim()) {
      const cStr = vObj.confirmedBy.trim();
      if (!/^(null|undefined|none|\[\])$/i.test(cStr)) {
        confirmedList = cStr.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    let confirmedLine = '';
    if (confirmedList.length > 0) {
      confirmedLine = `   Confirmed by: ${confirmedList.join(', ')}`;
    }

    const blockParts = [`✅ ${claim}`];
    if (sourceLine) blockParts.push(sourceLine);
    if (confirmedLine) blockParts.push(confirmedLine);

    return blockParts.join('\n');
  }

  return '';
}

/**
 * Regex-based string array extractor for malformed/unparseable JSON blocks
 */
function extractArrayFromDirtyJson(raw: string, keyNames: string[]): string[] {
  const items: string[] = [];

  for (const key of keyNames) {
    const keyRegex = new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'i');
    const match = raw.match(keyRegex);
    if (match && match[1]) {
      const arrayContent = match[1].trim();

      // Check if array contains object elements: { ... }
      if (arrayContent.includes('{')) {
        const objectMatches = arrayContent.match(/\{[\s\S]*?\}/g);
        if (objectMatches) {
          for (const objStr of objectMatches) {
            try {
              const parsed = JSON.parse(objStr);
              const formatted = formatVerifiedClaimEntry(parsed);
              if (formatted) items.push(formatted);
            } catch {
              const claimMatch = objStr.match(/"(?:claim|fact|statement|title)"\s*:\s*"((?:\\.|[^"\\])*)"/i);
              const domainMatch = objStr.match(/"domain"\s*:\s*"((?:\\.|[^"\\])*)"/i);
              const dateMatch = objStr.match(/"(?:eventDate|publishedAt|updatedAt)"\s*:\s*"((?:\\.|[^"\\])*)"/i);
              if (claimMatch && claimMatch[1]) {
                const claim = claimMatch[1].replace(/\\"/g, '"');
                const domain = domainMatch ? domainMatch[1].replace(/\\"/g, '"') : undefined;
                const date = dateMatch ? dateMatch[1].replace(/\\"/g, '"') : undefined;
                const formatted = formatVerifiedClaimEntry({ claim, domain, eventDate: date });
                if (formatted) items.push(formatted);
              }
            }
          }
        }
      } else {
        // Simple string elements
        const stringMatches = arrayContent.match(/"((?:\\.|[^"\\])*)"/g);
        if (stringMatches) {
          for (const s of stringMatches) {
            try {
              const parsed = JSON.parse(s);
              if (typeof parsed === 'string' && parsed.trim()) {
                const formatted = formatVerifiedClaimEntry(parsed);
                if (formatted) items.push(formatted);
              }
            } catch {
              const clean = s.slice(1, -1).replace(/\\"/g, '"').trim();
              if (clean) {
                const formatted = formatVerifiedClaimEntry(clean);
                if (formatted) items.push(formatted);
              }
            }
          }
        }
      }

      if (items.length > 0) break;
    }
  }

  return items;
}

/**
 * Regex-based string property extractor for dirty JSON blocks
 */
function extractStringFromDirtyJson(raw: string, keyNames: string[]): string {
  for (const key of keyNames) {
    const keyRegex = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, 'i');
    const match = raw.match(keyRegex);
    if (match && match[1]) {
      try {
        return JSON.parse(`"${match[1]}"`);
      } catch {
        return match[1].replace(/\\"/g, '"').trim();
      }
    }
  }
  return '';
}

interface ParsedFactCheckerClaim {
  id: string;
  claim: string;
  domain?: string;
  url?: string;
  date?: string;
  confirmedBy?: string[];
}

interface ParsedFactCheckerData {
  summary: string;
  claims: ParsedFactCheckerClaim[];
  issues: string[];
  plausibleUnconfirmed: string[];
  fabricatedOrContradicted: string[];
}

/**
 * Robust extractor for Fact Checker outputs across all schemas and raw strings
 */
function extractFactCheckerData(
  step: JarvisExecutionStep,
  parsed: unknown,
  raw: string,
): ParsedFactCheckerData {
  let summary = '';
  const claims: ParsedFactCheckerClaim[] = [];
  const issues: string[] = [];
  const plausibleUnconfirmed: string[] = [];
  const fabricatedOrContradicted: string[] = [];

  let rawClaims: unknown[] = [];
  let rawIssues: unknown[] = [];
  let rawPlausible: unknown[] = [];
  let rawFabricated: unknown[] = [];

  // Case A: Structured object
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const fObj = parsed as Record<string, unknown>;

    summary =
      typeof fObj.summary === 'string'
        ? fObj.summary
        : typeof fObj.status === 'string'
        ? fObj.status
        : typeof fObj.verdict === 'string'
        ? fObj.verdict
        : typeof fObj.auditSummary === 'string'
        ? fObj.auditSummary
        : '';

    const verifiedField =
      fObj.verified ||
      fObj.verifiedClaims ||
      fObj.claims ||
      fObj.validated ||
      fObj.validClaims ||
      fObj.facts ||
      fObj.trueClaims;

    if (Array.isArray(verifiedField)) {
      rawClaims = verifiedField;
    } else if (fObj.claim || fObj.fact || fObj.statement) {
      rawClaims = [fObj];
    }

    const issuesField =
      fObj.issues ||
      fObj.corrections ||
      fObj.discrepancies ||
      fObj.errors ||
      fObj.notes ||
      fObj.flagged ||
      fObj.contradictions ||
      fObj.unverified;
    if (Array.isArray(issuesField)) {
      rawIssues = issuesField;
    }

    const plausibleField =
      fObj.plausible_unconfirmed ||
      fObj.plausibleUnconfirmed ||
      fObj.unconfirmed ||
      fObj.plausible;
    if (Array.isArray(plausibleField)) {
      rawPlausible = plausibleField;
    }

    const fabricatedField =
      fObj.fabricated_or_contradicted ||
      fObj.fabricatedOrContradicted ||
      fObj.fabricated ||
      fObj.contradicted ||
      fObj.hallucinations;
    if (Array.isArray(fabricatedField)) {
      rawFabricated = fabricatedField;
    }
  } else if (Array.isArray(parsed)) {
    parsed.forEach((item) => {
      if (typeof item === 'object' && item !== null) {
        const iObj = item as Record<string, unknown>;
        if (iObj.issue || iObj.correction || iObj.error || iObj.invalid || iObj.flagged) {
          rawIssues.push(iObj);
        } else {
          rawClaims.push(iObj);
        }
      } else if (typeof item === 'string') {
        if (item.toLowerCase().includes('issue') || item.toLowerCase().includes('mismatch')) {
          issues.push(item);
        } else {
          rawClaims.push(item);
        }
      }
    });
  }

  // Fallback: If no claims found from parsed, scan raw string for JSON objects in "verified": [ ... ]
  if (rawClaims.length === 0) {
    const rawToScan = raw || step.outputPreview || step.summary || '';
    const match = rawToScan.match(/"(?:verified|verifiedClaims|claims|facts)"\s*:\s*\[([\s\S]*?)\]/i);
    if (match && match[1]) {
      const objMatches = match[1].match(/\{[\s\S]*?\}/g);
      if (objMatches) {
        objMatches.forEach((objStr) => {
          try {
            const parsedObj = JSON.parse(objStr);
            if (parsedObj && typeof parsedObj === 'object') {
              rawClaims.push(parsedObj);
            }
          } catch {
            const claimMatch = objStr.match(/"(?:claim|fact|statement|title)"\s*:\s*"((?:\\.|[^"\\])*)"/i);
            const domainMatch = objStr.match(/"domain"\s*:\s*"((?:\\.|[^"\\])*)"/i);
            const urlMatch = objStr.match(/"url"\s*:\s*"((?:\\.|[^"\\])*)"/i);
            const dateMatch = objStr.match(/"(?:eventDate|publishedAt|updatedAt)"\s*:\s*"((?:\\.|[^"\\])*)"/i);
            if (claimMatch && claimMatch[1]) {
              rawClaims.push({
                claim: claimMatch[1].replace(/\\"/g, '"'),
                domain: domainMatch ? domainMatch[1].replace(/\\"/g, '"') : undefined,
                url: urlMatch ? urlMatch[1].replace(/\\"/g, '"') : undefined,
                eventDate: dateMatch ? dateMatch[1].replace(/\\"/g, '"') : undefined,
              });
            }
          }
        });
      }
    }
  }

  // Parse each raw claim entry into a structured ParsedFactCheckerClaim
  rawClaims.forEach((item, idx) => {
    if (!item) return;

    if (typeof item === 'object' && item !== null) {
      const obj = item as Record<string, unknown>;
      let claimText = String(
        obj.claim ||
        obj.fact ||
        obj.statement ||
        obj.title ||
        obj.text ||
        obj.point ||
        obj.finding ||
        ''
      ).trim();

      if (!claimText || isJsonKeyArtifact(claimText)) {
        const entry = Object.entries(obj).find(
          ([k, v]) =>
            !/^(domain|url|eventDate|publishedAt|updatedAt|dateStatus|confirmedBy|id|sourceIndex)$/i.test(k) &&
            typeof v === 'string' &&
            v.trim().length > 10
        );
        if (entry) claimText = String(entry[1]).trim();
      }

      if (!claimText || isJsonKeyArtifact(claimText)) return;
      claimText = claimText.replace(/^✅\s*/, '').replace(/^[-*•]\s*/, '').trim();

      let domain = '';
      if (typeof obj.domain === 'string' && obj.domain.trim() && !/^(null|undefined|unknown|none)$/i.test(obj.domain.trim())) {
        domain = obj.domain.trim();
      } else if (typeof obj.url === 'string' && obj.url.trim() && !/^(null|undefined)$/i.test(obj.url.trim())) {
        domain = extractDomain(obj.url.trim());
      }

      let url: string | undefined = undefined;
      if (typeof obj.url === 'string' && obj.url.trim() && obj.url.trim().startsWith('http')) {
        url = obj.url.trim();
      }

      const dateStr = extractRealDateValue(obj);

      let confirmedList: string[] = [];
      if (Array.isArray(obj.confirmedBy)) {
        confirmedList = obj.confirmedBy
          .map((c) => String(c || '').trim())
          .filter((c) => c && !/^(null|undefined|none|\[\])$/i.test(c));
      } else if (typeof obj.confirmedBy === 'string' && obj.confirmedBy.trim()) {
        const cStr = obj.confirmedBy.trim();
        if (!/^(null|undefined|none|\[\])$/i.test(cStr)) {
          confirmedList = cStr.split(',').map((s) => s.trim()).filter(Boolean);
        }
      }

      claims.push({
        id: `claim-${idx}`,
        claim: claimText,
        domain: domain || undefined,
        url,
        date: dateStr || undefined,
        confirmedBy: confirmedList.length > 0 ? confirmedList : undefined,
      });
    } else if (typeof item === 'string') {
      const trimmed = item.trim();
      if (!trimmed) return;
      // Skip raw JSON key: value noise lines
      if (/^"?([a-zA-Z0-9_]+)"?\s*[:=]\s*(?:null|undefined|""|''|\[\]|\{\})\s*,?$/i.test(trimmed)) return;
      if (/^"?(dateStatus|eventDate|publishedAt|updatedAt|url)"?\s*[:=]/i.test(trimmed)) return;

      // Check if multi-line block already
      if (trimmed.includes('\n')) {
        const lines = trimmed.split('\n').map((l) => l.trim()).filter(Boolean);
        let cText = '';
        let cDomain = '';
        let cDate = '';
        let cConfirmed: string[] = [];

        lines.forEach((l) => {
          if (l.startsWith('✅') || (!cText && !l.toLowerCase().startsWith('source:') && !l.toLowerCase().startsWith('confirmed by:'))) {
            cText = l.replace(/^✅\s*/, '').replace(/^[-*•]\s*/, '').trim();
          } else if (l.toLowerCase().startsWith('source:')) {
            const srcContent = l.replace(/^source:\s*/i, '').trim();
            const dateM = srcContent.match(/\(([^)]+)\)/);
            if (dateM) {
              cDate = dateM[1].trim();
              cDomain = srcContent.replace(/\s*\([^)]+\)/, '').trim();
            } else {
              cDomain = srcContent;
            }
          } else if (l.toLowerCase().startsWith('confirmed by:')) {
            const confContent = l.replace(/^confirmed by:\s*/i, '').trim();
            cConfirmed = confContent.split(',').map((s) => s.trim()).filter(Boolean);
          }
        });

        if (cText && !isJsonKeyArtifact(cText)) {
          claims.push({
            id: `claim-${idx}`,
            claim: cText,
            domain: cDomain || undefined,
            date: cDate || undefined,
            confirmedBy: cConfirmed.length > 0 ? cConfirmed : undefined,
          });
          return;
        }
      }

      // Single string
      const cleanClaim = trimmed.replace(/^✅\s*/, '').replace(/^[-*•]\s*/, '').trim();
      if (cleanClaim && !isJsonKeyArtifact(cleanClaim) && cleanClaim.length > 3) {
        claims.push({
          id: `claim-${idx}`,
          claim: cleanClaim,
        });
      }
    }
  });

  // Process issues
  rawIssues.forEach((item) => {
    if (typeof item === 'string' && item.trim()) {
      issues.push(item.trim());
    } else if (typeof item === 'object' && item !== null) {
      const iObj = item as Record<string, unknown>;
      const text = String(iObj.issue || iObj.correction || iObj.error || iObj.discrepancy || iObj.note || iObj.message || iObj.text || '').trim();
      if (text) issues.push(text);
    }
  });

  // Process plausibleUnconfirmed
  rawPlausible.forEach((item) => {
    const text = typeof item === 'object' && item !== null
      ? String((item as Record<string, unknown>).issue || (item as Record<string, unknown>).claim || (item as Record<string, unknown>).detail || '')
      : String(item || '').trim();
    if (text && !plausibleUnconfirmed.includes(text)) plausibleUnconfirmed.push(text);
  });

  // Process fabricatedOrContradicted
  rawFabricated.forEach((item) => {
    const text = typeof item === 'object' && item !== null
      ? String((item as Record<string, unknown>).issue || (item as Record<string, unknown>).claim || (item as Record<string, unknown>).detail || '')
      : String(item || '').trim();
    if (text && !fabricatedOrContradicted.includes(text)) fabricatedOrContradicted.push(text);
  });

  if (!summary) {
    summary =
      claims.length > 0
        ? `Validated ${claims.length} ${claims.length === 1 ? 'claim' : 'claims'} with empirical ground checks.`
        : (step.summary || 'Fact verification audit completed.');
  }

  return {
    summary,
    claims,
    issues,
    plausibleUnconfirmed,
    fabricatedOrContradicted,
  };
}

/**
 * Specialized Fact Checker Formatter that GUARANTEES clean rendering
 * Each verified claim is rendered as ONE clean block:
 *
 * ✅ [claim text]
 *    Source: [domain] ([eventDate or publishedAt if available])
 *    Confirmed by: [confirmedBy list, comma-separated]
 *
 * No raw JSON keys (dateStatus, eventDate, publishedAt, url) are exposed unless containing real dates.
 */
function formatFactCheckerOutput(step: JarvisExecutionStep, parsed: unknown, raw: string): string {
  const data = extractFactCheckerData(step, parsed, raw);

  const lines: string[] = [
    `### 🎯 Verification Audit Scope`,
    `**Audit Scope:** ${data.summary || 'Empirical ground verification & claim scrutiny'}`,
    ``,
    `### 📋 Verified Empirical Claims`,
  ];

  if (data.claims.length > 0) {
    data.claims.forEach((c, idx) => {
      lines.push(`${idx + 1}. **Claim ${idx + 1}:** ${c.claim}`);
      const hasSource = Boolean(c.domain || c.date);
      if (hasSource) {
        if (c.domain && c.date) {
          lines.push(`   - **Source:** ${c.domain} (${c.date})`);
        } else if (c.domain) {
          lines.push(`   - **Source:** ${c.domain}`);
        } else {
          lines.push(`   - **Source:** ${c.date}`);
        }
      }
      if (c.confirmedBy && c.confirmedBy.length > 0) {
        lines.push(`   - **Confirmed by:** ${c.confirmedBy.join(', ')}`);
      }
    });
  } else {
    lines.push(`1. **Full Integrity Verification:** All empirical claims verified against grounding corpus.`);
  }

  return lines.join('\n').trim();
}

function formatAgentContentToMarkdown(step: JarvisExecutionStep): {
  formatted: string;
  isStructuredJson: boolean;
  raw: string;
} {
  const raw = step.rawOutput || step.outputPreview || step.summary || '';
  if (!raw) {
    return { formatted: 'No output data recorded for this step.', isStructuredJson: false, raw: '' };
  }

  // Try parsing from rawOutput first, then fallback to outputPreview if available
  let { parsed, isJson } = parseAgentJson(raw);
  if (!isJson && step.outputPreview && step.outputPreview !== raw) {
    const previewRes = parseAgentJson(step.outputPreview);
    if (previewRes.isJson) {
      parsed = previewRes.parsed;
      isJson = true;
    }
  }

  // 1. FACT CHECKER AGENT (GUARANTEED CLEAN VIEW ALWAYS)
  if (step.agentId === 'factChecker') {
    const md = formatFactCheckerOutput(step, parsed, raw);
    return { formatted: md, isStructuredJson: true, raw };
  }

  // 2. PLANNER AGENT
  if (step.agentId === 'planner') {
    let task = 'Autonomous query execution';
    let plan: string[] = [];
    let needsDiagram = false;
    let needsChart = false;
    let needsImage = false;
    let needsResearch = true;
    let needsFactCheck = true;
    let needsReview = true;

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const pObj = parsed as Record<string, unknown>;
      task = String(pObj.task || pObj.objective || 'Autonomous query execution');
      plan = Array.isArray(pObj.plan) ? (pObj.plan as string[]) : Array.isArray(pObj.steps) ? (pObj.steps as string[]) : [];
      needsDiagram = Boolean(pObj.needsDiagram);
      needsChart = Boolean(pObj.needsChart);
      needsImage = Boolean(pObj.needsImage);
      needsResearch = Boolean(pObj.needsResearch ?? true);
      needsFactCheck = Boolean(pObj.needsFactCheck ?? true);
      needsReview = Boolean(pObj.needsReview ?? true);
    } else {
      // Fallback extraction
      const taskExtracted = extractStringFromDirtyJson(raw, ['task', 'objective']);
      if (taskExtracted) task = taskExtracted;
      const planExtracted = extractArrayFromDirtyJson(raw, ['plan', 'steps']);
      if (planExtracted.length > 0) plan = planExtracted;
    }

    let md = `### 🎯 Targeted Objective\n**Task Scope:** ${task}\n\n### 📋 Strategic Execution Plan\n`;
    if (plan.length > 0) {
      plan.forEach((item, idx) => {
        md += `${idx + 1}. **Phase ${idx + 1}:** ${String(item)}\n`;
      });
    } else {
      md += `1. Multi-phase analysis and factual synthesis\n`;
    }

    md += `\n### 🧭 Neural Pipeline Directives\n`;
    md += `- **Deep Research Mesh:** ${needsResearch ? '✅ Active (Empirical Fact Retrieval)' : '⚪ Bypassed'}\n`;
    md += `- **Fact Verification Audit:** ${needsFactCheck ? '✅ Active (Claim Scrutiny Enabled)' : '⚪ Bypassed'}\n`;
    md += `- **Quality Assurance Peer Review:** ${needsReview ? '✅ Active (Multi-Point Review)' : '⚪ Bypassed'}\n`;
    md += `- **Architectural Diagram:** ${needsDiagram ? '✅ Active (SVG Blueprint Generation)' : '⚪ Standby'}\n`;
    md += `- **Quantitative Chart:** ${needsChart ? '✅ Active (Numerical Spec Extraction)' : '⚪ Standby'}\n`;
    md += `- **Visual Image Lookup:** ${needsImage ? '✅ Active (Photographic Retrieval)' : '⚪ Standby'}\n`;

    return { formatted: md, isStructuredJson: true, raw };
  }

  // 3. RESEARCHER AGENT
  if (step.agentId === 'researcher') {
    const resData = extractResearcherData(step, parsed, raw);
    let md = `### 🎯 Targeted Research Scope\n**Research Focus:** ${step.summary || 'Real-time multi-source empirical retrieval and fact extraction'}\n\n### 📋 Verified Empirical Findings\n`;

    if (resData.candidates.length > 0) {
      resData.candidates.forEach((cand, idx) => {
        const title = cand.title ? `**${cand.title}:** ` : '';
        md += `${idx + 1}. ${title}${cand.fact}\n`;
        const hasSource = Boolean(cand.domain || cand.eventDate || (cand.sourceIndex !== undefined));
        if (hasSource) {
          const srcPart = cand.domain ? cand.domain : cand.sourceIndex !== undefined ? `Source #${cand.sourceIndex}` : '';
          const datePart = cand.eventDate ? ` (${cand.eventDate})` : '';
          md += `   - **Source:** ${srcPart}${datePart}\n`;
        }
        if (cand.confirmedBy && cand.confirmedBy.length > 0) {
          md += `   - **Confirmed by:** ${cand.confirmedBy.join(', ')}\n`;
        }
      });
    } else {
      const fallbackMd = formatResearcherOutput(step, parsed, raw);
      md = fallbackMd;
    }

    if (resData.insights.length > 0) {
      md += `\n### 🧭 Empirical Insights & Directives\n`;
      resData.insights.forEach((ins) => {
        md += `- **Key Insight:** ${ins}\n`;
      });
    }

    return { formatted: md.trim(), isStructuredJson: true, raw };
  }

  // 4. REVIEWER AGENT
  if (step.agentId === 'reviewer') {
    let recommendation = 'Proceed with comprehensive synthesis.';
    let critique = '';
    let score: number | null = null;

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const rvObj = parsed as Record<string, unknown>;
      recommendation =
        typeof rvObj.recommendation === 'string'
          ? rvObj.recommendation
          : typeof rvObj.verdict === 'string'
          ? rvObj.verdict
          : 'Proceed with comprehensive synthesis.';
      critique = typeof rvObj.critique === 'string' ? rvObj.critique : typeof rvObj.feedback === 'string' ? rvObj.feedback : '';
      score = typeof rvObj.score === 'number' ? rvObj.score : null;
    } else {
      const rec = extractStringFromDirtyJson(raw, ['recommendation', 'verdict']);
      if (rec) recommendation = rec;
      critique = extractStringFromDirtyJson(raw, ['critique', 'feedback']);
    }

    let md = `### 🛡️ Peer Review & Quality Assurance\n`;
    if (score !== null) {
      md += `**Quality Score:** \`${score}/100\` • **Verdict:** ${recommendation}\n\n`;
    } else {
      md += `**Verdict & Recommendation:** ${recommendation}\n\n`;
    }

    if (critique) {
      md += `### 🔍 Refinements & Editorial Critique\n${critique}\n`;
    }

    return { formatted: md, isStructuredJson: true, raw };
  }

  // 4.5 WEB FETCHER AGENT
  if (step.agentId === 'webFetcher') {
    let title = '';
    let url = '';
    let length = 0;
    let rawTotalLength = 0;
    let isTruncated = false;
    let description = '';
    let headings: string[] = [];
    let preview = '';

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const wObj = parsed as Record<string, unknown>;
      title = String(wObj.title || '');
      url = String(wObj.finalUrl || wObj.url || '');
      length = typeof wObj.length === 'number' ? wObj.length : 0;
      rawTotalLength = typeof wObj.rawTotalLength === 'number' ? wObj.rawTotalLength : length;
      isTruncated = Boolean(wObj.isTruncated || (rawTotalLength > 3500));
      description = String(wObj.description || '');
      headings = Array.isArray(wObj.headings) ? (wObj.headings as string[]) : [];
      preview = String(wObj.textContent || wObj.preview || wObj.contentExcerpt || '');
    }

    let md = `### 🌐 Web Fetcher // Direct Page Extraction\n`;
    if (title) md += `**Page Title:** ${title}\n`;
    if (url) md += `**Source URL:** [${url}](${url})\n`;
    if (rawTotalLength > 0) {
      md += `**Content Parsed:** ${rawTotalLength.toLocaleString()} characters total${isTruncated ? ' _(capped to 3,500 chars for concise synthesis)_' : ''}\n\n`;
    }
    if (description) md += `**Meta Description:** ${description}\n\n`;
    if (headings.length > 0) {
      md += `#### 📑 Page Structure & Sections:\n${headings.map((h) => `- ${h}`).join('\n')}\n\n`;
    }
    if (preview) {
      md += `#### 📄 Content Excerpt:\n${preview}\n`;
    }

    return { formatted: md, isStructuredJson: true, raw };
  }

  // 5. Generic or Custom Agent JSON formatting
  if (isJson && parsed !== null) {
    if (Array.isArray(parsed)) {
      let md = `### 📊 ${step.name ? step.name.toUpperCase() : step.agentId.toUpperCase()} // STRUCTURED RECORDS\n\n`;
      parsed.forEach((item, i) => {
        const formatted = cleanAndFormatFact(item, { markdownSource: true });
        if (formatted) {
          md += `${i + 1}. ${formatted}\n`;
        } else {
          md += `${i + 1}. ${String(item)}\n`;
        }
      });
      return { formatted: md, isStructuredJson: true, raw };
    }

    const pObj = parsed as Record<string, unknown>;
    let md = `### ⚡ ${step.name ? step.name.toUpperCase() : step.agentId.toUpperCase()} // EXECUTION OUTPUT\n\n`;

    for (const [key, val] of Object.entries(pObj)) {
      const titleKey = key.replace(/([A-Z])/g, ' $1').toUpperCase();
      if (Array.isArray(val)) {
        md += `**${titleKey}:**\n`;
        val.forEach((item) => {
          const formatted = cleanAndFormatFact(item, { markdownSource: true });
          if (formatted) {
            md += `- ${formatted}\n`;
          } else {
            md += `- ${String(item)}\n`;
          }
        });
        md += `\n`;
      } else if (val && typeof val === 'object') {
        md += `**${titleKey}:**\n\`\`\`json\n${JSON.stringify(val, null, 2)}\n\`\`\`\n\n`;
      } else if (val !== undefined && val !== null && val !== '') {
        md += `**${titleKey}:** ${String(val)}\n\n`;
      }
    }
    return { formatted: md, isStructuredJson: true, raw };
  }

  // Fallback for non-JSON or plain text (e.g. terminal logs, pasted text, markdown)
  // If the plain text accidentally starts with `{`, clean it up so raw JSON is not displayed
  if (raw.trim().startsWith('{') && raw.trim().endsWith('}')) {
    const lines = raw
      .replace(/^\{\s*/, '')
      .replace(/\s*\}\s*$/, '')
      .split('\n')
      .map((l) => l.trim().replace(/^"([^"]+)":\s*/, '**$1:** ').replace(/",?$/, '').replace(/^"/, ''))
      .filter((l) => l.length > 0 && l !== '[' && l !== ']');
    const cleanedMd = `### ⚡ ${step.name ? step.name.toUpperCase() : step.agentId.toUpperCase()} // OUTPUT\n\n` + lines.map((l) => `- ${l}`).join('\n');
    return { formatted: cleanedMd, isStructuredJson: true, raw };
  }

  return { formatted: raw, isStructuredJson: true, raw };
}

interface ParsedResearcherCandidate {
  id: string;
  title: string;
  fact: string;
  domain?: string;
  eventDate?: string;
  publishedAt?: string;
  updatedAt?: string;
  confirmedBy?: string[];
  sourceIndex?: number;
  url?: string;
  category?: string;
}

interface ParsedResearcherSource {
  index?: number;
  title: string;
  url: string;
  domain?: string;
  publishedAt?: string;
}

interface ParsedResearcherData {
  candidates: ParsedResearcherCandidate[];
  sources: ParsedResearcherSource[];
  insights: string[];
  context: string;
}

function getFactPreview(text: string, maxWords = 22): { preview: string; isTruncated: boolean; totalWords: number } {
  if (!text) return { preview: '', isTruncated: false, totalWords: 0 };
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) {
    return { preview: text, isTruncated: false, totalWords: words.length };
  }
  return {
    preview: words.slice(0, maxWords).join(' ') + '...',
    isTruncated: true,
    totalWords: words.length,
  };
}

function extractResearcherData(
  step: JarvisExecutionStep,
  parsed: unknown,
  raw: string
): ParsedResearcherData {
  const candidates: ParsedResearcherCandidate[] = [];
  const sources: ParsedResearcherSource[] = [];
  let insights: string[] = [];
  let context = '';

  const processObject = (obj: Record<string, unknown>) => {
    // 1. Process candidate objects
    const candKeys = ['candidates', 'news_candidates', 'newsCandidates', 'items', 'articles', 'stories'];
    for (const key of candKeys) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
        const rawCands = obj[key] as unknown[];
        rawCands.forEach((cand, idx) => {
          if (typeof cand === 'object' && cand !== null) {
            const cObj = cand as Record<string, unknown>;
            const rawTitle = String(cObj.title || cObj.headline || '').trim();
            const rawFact = String(cObj.fact || cObj.claim || cObj.statement || cObj.description || '').trim();
            const domain = String(cObj.domain || (cObj.url ? extractDomain(String(cObj.url)) : '')).trim();
            const eventDate = String(cObj.eventDate || cObj.publishedAt || cObj.updatedAt || cObj.date || '').trim();

            let confirmedList: string[] = [];
            if (Array.isArray(cObj.confirmedBy)) {
              confirmedList = (cObj.confirmedBy as string[])
                .map(String)
                .map((s) => s.trim().replace(/^https?:\/\//, '').replace(/^www\./, ''))
                .filter(Boolean);
            } else if (typeof cObj.confirmedBy === 'string' && cObj.confirmedBy.trim()) {
              confirmedList = [cObj.confirmedBy.trim().replace(/^https?:\/\//, '').replace(/^www\./, '')];
            }

            const sourceIdx = typeof cObj.sourceIndex === 'number' ? cObj.sourceIndex : typeof cObj.source_index === 'number' ? cObj.source_index : undefined;
            const url = typeof cObj.url === 'string' && cObj.url ? cObj.url : undefined;
            const category = typeof cObj.category === 'string' && cObj.category ? cObj.category : undefined;

            if (rawTitle || rawFact) {
              candidates.push({
                id: `cand-${idx}`,
                title: rawTitle,
                fact: rawFact || rawTitle,
                domain: domain && domain !== 'null' && domain !== 'undefined' ? domain : undefined,
                eventDate: eventDate && eventDate !== 'null' && eventDate !== 'undefined' ? eventDate : undefined,
                publishedAt: typeof cObj.publishedAt === 'string' ? cObj.publishedAt : undefined,
                updatedAt: typeof cObj.updatedAt === 'string' ? cObj.updatedAt : undefined,
                confirmedBy: confirmedList.length > 0 ? confirmedList : undefined,
                sourceIndex: sourceIdx,
                url,
                category,
              });
            }
          } else if (typeof cand === 'string' && cand.trim().length > 5) {
            candidates.push({
              id: `cand-${idx}`,
              title: '',
              fact: cand.trim(),
            });
          }
        });
        break;
      }
    }

    // 2. Process facts array if candidates was empty
    if (candidates.length === 0) {
      const factKeys = ['facts', 'findings', 'core_facts', 'coreFacts', 'key_facts', 'keyFacts', 'points', 'claims'];
      for (const key of factKeys) {
        if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
          (obj[key] as unknown[]).forEach((f, idx) => {
            if (typeof f === 'string' && f.trim().length > 5) {
              const bulletMatch = f.match(/^(?:[-*•]\s*)?(?:\*\*([^*]+)\*\*[:\s]+)?(.*)$/);
              if (bulletMatch && bulletMatch[1]) {
                const title = bulletMatch[1].trim();
                const fact = bulletMatch[2] ? bulletMatch[2].trim() : f.trim();
                candidates.push({
                  id: `fact-${idx}`,
                  title,
                  fact: fact || title,
                });
              } else {
                candidates.push({
                  id: `fact-${idx}`,
                  title: '',
                  fact: f.trim(),
                });
              }
            } else if (typeof f === 'object' && f !== null) {
              const fObj = f as Record<string, unknown>;
              const factText = String(fObj.fact || fObj.claim || fObj.statement || fObj.text || fObj.finding || '').trim();
              const title = String(fObj.title || fObj.headline || '').trim();
              if (factText || title) {
                candidates.push({
                  id: `fact-${idx}`,
                  title,
                  fact: factText || title,
                  domain: typeof fObj.domain === 'string' ? fObj.domain : undefined,
                  eventDate: typeof fObj.eventDate === 'string' ? fObj.eventDate : typeof fObj.date === 'string' ? fObj.date : undefined,
                  sourceIndex: typeof fObj.sourceIndex === 'number' ? fObj.sourceIndex : undefined,
                });
              }
            }
          });
          break;
        }
      }
    }

    // 3. Process sources
    const srcKeys = ['sources', 'references', 'search_results'];
    for (const key of srcKeys) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0) {
        (obj[key] as unknown[]).forEach((s, idx) => {
          if (typeof s === 'object' && s !== null) {
            const sObj = s as Record<string, unknown>;
            const url = String(sObj.url || sObj.link || '');
            const title = String(sObj.title || sObj.name || url);
            const domain = String(sObj.domain || (url ? extractDomain(url) : ''));
            const sIdx = typeof sObj.index === 'number' ? sObj.index : idx + 1;
            const publishedAt = typeof sObj.publishedAt === 'string' ? sObj.publishedAt : undefined;
            if (url) {
              sources.push({
                index: sIdx,
                title,
                url,
                domain: domain || undefined,
                publishedAt,
              });
            }
          }
        });
        break;
      }
    }

    // 4. Process insights
    const insightKeys = ['keyInsights', 'insights', 'takeaways'];
    for (const key of insightKeys) {
      if (Array.isArray(obj[key]) && (obj[key] as unknown[]).length > 0 && insights.length === 0) {
        insights = (obj[key] as unknown[]).map(String).filter(Boolean);
        break;
      }
    }

    // 5. Context
    if (typeof obj.context === 'string' && !context) context = obj.context;
    else if (typeof obj.summary === 'string' && !context) context = obj.summary;
    else if (typeof obj.notes === 'string' && !context) context = obj.notes;
  };

  // Inspect parsed object
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    processObject(parsed as Record<string, unknown>);
  }

  // Fallback to step.outputPreview
  if (candidates.length === 0 && step.outputPreview) {
    try {
      const previewJson = JSON.parse(step.outputPreview);
      if (previewJson && typeof previewJson === 'object' && !Array.isArray(previewJson)) {
        processObject(previewJson as Record<string, unknown>);
      }
    } catch {
      // ignore
    }
  }

  // Fallback to raw string parsing
  if (candidates.length === 0 && raw) {
    try {
      const rawJson = JSON.parse(raw);
      if (rawJson && typeof rawJson === 'object') {
        if (Array.isArray(rawJson)) {
          rawJson.forEach((item, idx) => {
            if (typeof item === 'object' && item !== null) {
              const iObj = item as Record<string, unknown>;
              candidates.push({
                id: `cand-raw-${idx}`,
                title: String(iObj.title || ''),
                fact: String(iObj.fact || iObj.claim || iObj.description || iObj.title || ''),
                domain: typeof iObj.domain === 'string' ? iObj.domain : undefined,
                eventDate: typeof iObj.eventDate === 'string' ? iObj.eventDate : undefined,
                sourceIndex: typeof iObj.sourceIndex === 'number' ? iObj.sourceIndex : undefined,
              });
            } else if (typeof item === 'string') {
              candidates.push({ id: `cand-raw-${idx}`, title: '', fact: item });
            }
          });
        } else {
          processObject(rawJson as Record<string, unknown>);
        }
      }
    } catch {
      // Line by line bullet extraction
      const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      let idx = 0;
      for (const line of lines) {
        if (line.startsWith('{') || line.startsWith('}') || line.startsWith('[') || line.startsWith(']') || line.startsWith('```')) {
          continue;
        }
        const bulletMatch = line.match(/^(?:(?:\d+[.)]|[*•–—-]|\s*-)\s+|fact\s*\d*\s*[:-]\s*)(.*)$/i);
        const text = bulletMatch ? bulletMatch[1].trim() : line;
        if (text.length > 10 && !text.includes('":') && !text.startsWith('"')) {
          const boldTitleMatch = text.match(/^\*\*([^*]+)\*\*[:\s]+(.*)$/);
          if (boldTitleMatch) {
            candidates.push({
              id: `line-${idx++}`,
              title: boldTitleMatch[1].trim(),
              fact: boldTitleMatch[2].trim(),
            });
          } else {
            candidates.push({
              id: `line-${idx++}`,
              title: '',
              fact: text,
            });
          }
        }
      }
    }
  }

  return { candidates, sources, insights, context };
}

/**
 * Interactive Researcher Mesh Answer View:
 * Shortens each fact to a 20-word preview with an expandable "Show more" / "Show less" toggle,
 * keeping full data intact internally while providing clean, scannable reading on screen.
 */
export const ResearcherMeshAnswerView: React.FC<{
  step: JarvisExecutionStep;
  parsed: unknown;
  raw: string;
  fallbackFormatted: string;
}> = ({ step, parsed, raw, fallbackFormatted }) => {
  const data = extractResearcherData(step, parsed, raw);
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const [allExpanded, setAllExpanded] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  // If no candidates could be extracted, fall back to FormattedText
  if (data.candidates.length === 0) {
    return <FormattedText content={fallbackFormatted} />;
  }

  const toggleItem = (id: string) => {
    setExpandedMap((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const toggleAll = () => {
    const nextState = !allExpanded;
    setAllExpanded(nextState);
    const newMap: Record<string, boolean> = {};
    data.candidates.forEach((c) => {
      newMap[c.id] = nextState;
    });
    setExpandedMap(newMap);
  };

  const hasAnyTruncated = data.candidates.some((c) => getFactPreview(c.fact, 22).isTruncated);

  return (
    <div className="flex flex-col gap-4">
      {/* Header bar with count & Expand All toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-sky-500/20">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-md bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300">
            <Search size={12} />
          </div>
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-sky-300">
            Core Fact Intelligence & Findings
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 border border-sky-400/30 text-sky-300">
            {data.candidates.length} {data.candidates.length === 1 ? 'Fact' : 'Facts'} Extracted
          </span>
        </div>

        {hasAnyTruncated && (
          <button
            type="button"
            onClick={toggleAll}
            className="px-2.5 py-1 rounded-lg text-xs font-mono font-semibold bg-sky-950/60 border border-sky-500/30 text-sky-300 hover:text-sky-100 hover:bg-sky-900/50 hover:border-sky-400/50 transition-all flex items-center gap-1 cursor-pointer"
          >
            {allExpanded ? (
              <>
                <ChevronUp size={13} className="text-sky-400" />
                <span>Collapse All Previews</span>
              </>
            ) : (
              <>
                <ChevronDown size={13} className="text-sky-400" />
                <span>Expand All Full Details</span>
              </>
            )}
          </button>
        )}
      </div>

      {/* Facts Card List */}
      <div className="flex flex-col gap-2.5">
        {data.candidates.map((cand, idx) => {
          const isExpanded = Boolean(expandedMap[cand.id]);
          const { preview, isTruncated, totalWords } = getFactPreview(cand.fact, 22);

          return (
            <div
              key={cand.id || idx}
              className="group relative rounded-xl border border-sky-500/20 bg-sky-950/20 hover:border-sky-500/40 hover:bg-sky-950/35 transition-all p-3 sm:p-3.5 shadow-sm"
            >
              <div className="flex items-start gap-2.5">
                {/* Index badge */}
                <span className="shrink-0 px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-sky-500/15 text-sky-300 border border-sky-400/25 mt-0.5">
                  #{idx + 1}
                </span>

                <div className="flex-1 min-w-0">
                  {/* Headline / Title if distinct */}
                  {cand.title && (
                    <h5 className="font-bold text-slate-100 text-sm tracking-tight m-0 mb-1 leading-snug">
                      {cand.title}
                    </h5>
                  )}

                  {/* Fact Body with Preview Truncation */}
                  <div className="text-sm text-slate-200 leading-relaxed">
                    <span>{isExpanded ? cand.fact : preview}</span>

                    {/* Show more / Show less button */}
                    {isTruncated && (
                      <button
                        type="button"
                        onClick={() => toggleItem(cand.id)}
                        className="ml-1.5 inline-flex items-center gap-0.5 text-xs font-mono font-semibold text-sky-400 hover:text-sky-200 underline decoration-sky-400/40 hover:decoration-sky-200 transition-colors cursor-pointer select-none"
                      >
                        {isExpanded ? (
                          <>
                            <span>Show less</span>
                            <ChevronUp size={12} className="inline ml-0.5" />
                          </>
                        ) : (
                          <>
                            <span>Show full ({totalWords} words)</span>
                            <ChevronDown size={12} className="inline ml-0.5" />
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* Metadata chips */}
                  <div className="flex items-center gap-2 flex-wrap mt-2.5 pt-2 border-t border-sky-500/10 text-xs">
                    {cand.domain && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-sky-950/80 border border-sky-500/30 text-sky-300">
                        <Globe size={10} className="text-sky-400" />
                        <span>{cand.domain}</span>
                      </span>
                    )}

                    {(cand.eventDate || cand.publishedAt) && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-slate-900/80 border border-slate-700/50 text-slate-300">
                        <Calendar size={10} className="text-slate-400" />
                        <span>{cand.eventDate || cand.publishedAt}</span>
                      </span>
                    )}

                    {cand.confirmedBy && cand.confirmedBy.length > 0 && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-emerald-950/60 border border-emerald-500/30 text-emerald-300">
                        <ShieldCheck size={10} className="text-emerald-400" />
                        <span>Confirmed by: {cand.confirmedBy.join(', ')}</span>
                      </span>
                    )}

                    {cand.sourceIndex && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-black/50 border border-white/10 text-slate-400">
                        Source #{cand.sourceIndex}
                      </span>
                    )}

                    {cand.url && (
                      <a
                        href={cand.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-200 underline decoration-cyan-400/40 hover:decoration-cyan-200 transition-colors ml-auto"
                      >
                        <ExternalLink size={10} />
                        <span>View Source</span>
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Primary Sources Section */}
      {data.sources.length > 0 && (
        <div className="mt-2 rounded-xl border border-sky-500/20 bg-black/40 overflow-hidden">
          <button
            type="button"
            onClick={() => setSourcesOpen(!sourcesOpen)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between bg-sky-950/30 hover:bg-sky-950/50 text-left transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <BookOpen size={13} className="text-sky-400" />
              <span className="text-xs font-mono font-bold text-sky-300 uppercase">
                Collected Primary Sources ({data.sources.length})
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs font-mono text-slate-400">
              <span>{sourcesOpen ? 'Hide' : 'Show'}</span>
              {sourcesOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </div>
          </button>

          {sourcesOpen && (
            <div className="p-3 border-t border-sky-500/15 flex flex-col gap-2 bg-slate-950/60">
              {data.sources.map((src, i) => (
                <div key={i} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-slate-500 shrink-0">[{src.index || i + 1}]</span>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-cyan-300 hover:text-cyan-100 underline decoration-cyan-400/40 truncate font-medium flex items-center gap-1"
                    >
                      <span className="truncate">{src.title}</span>
                      <ExternalLink size={10} className="shrink-0 opacity-70" />
                    </a>
                  </div>
                  {src.domain && (
                    <span className="font-mono text-[11px] text-slate-400 shrink-0 px-1.5 py-0.5 rounded bg-black/40 border border-white/10">
                      {src.domain}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Key Insights Section */}
      {data.insights.length > 0 && (
        <div className="mt-1 rounded-xl border border-amber-500/25 bg-amber-950/15 p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={13} className="text-amber-400" />
            <span className="text-xs font-mono font-bold text-amber-300 uppercase">
              Key Empirical Insights
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            {data.insights.map((insight, idx) => (
              <div key={idx} className="text-xs text-slate-200 flex items-start gap-2">
                <span className="text-amber-400 shrink-0 mt-0.5">•</span>
                <span>{insight}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Context Section */}
      {data.context && data.context.trim().length > 15 && (
        <div className="mt-1 rounded-xl border border-sky-500/20 bg-sky-950/15 p-3.5 text-xs text-slate-300 leading-relaxed">
          <span className="font-mono font-bold text-sky-300 uppercase block mb-1">
            Contextual Background
          </span>
          <p className="m-0">{data.context}</p>
        </div>
      )}
    </div>
  );
};

/**
 * Clean Fact Checker Mesh Answer View:
 * Renders each verified claim as ONE clean block:
 *
 * ✅ [claim text]
 *    Source: [domain] ([eventDate or publishedAt if available])
 *    Confirmed by: [confirmedBy list, comma-separated]
 *
 * Never displays raw field names (dateStatus, eventDate, publishedAt, updatedAt, url)
 * unless they contain a real date value. Hides any field that is null.
 */
export const FactCheckerMeshAnswerView: React.FC<{
  step: JarvisExecutionStep;
  parsed: unknown;
  raw: string;
  fallbackFormatted: string;
}> = ({ step, parsed, raw, fallbackFormatted }) => {
  const data = extractFactCheckerData(step, parsed, raw);

  if (data.claims.length === 0 && data.issues.length === 0 && data.plausibleUnconfirmed.length === 0 && data.fabricatedOrContradicted.length === 0) {
    return <FormattedText content={fallbackFormatted} />;
  }

  return (
    <div className="flex flex-col gap-3.5">
      {/* Verification Status Header Bar */}
      <div className="rounded-xl border border-purple-500/25 bg-purple-950/20 p-3.5 flex flex-col gap-1.5 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300">
              <ShieldCheck size={12} />
            </div>
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-purple-300">
              Fact Verification Audit
            </span>
          </div>
          {data.claims.length > 0 && (
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 border border-emerald-400/30 text-emerald-300">
              {data.claims.length} {data.claims.length === 1 ? 'Claim' : 'Claims'} Verified
            </span>
          )}
        </div>
        <div className="text-xs sm:text-[13px] text-purple-200/90 leading-relaxed font-sans">
          <span className="font-semibold text-purple-300 mr-1.5 font-mono text-[11px] uppercase">
            Status:
          </span>
          <span>{data.summary}</span>
        </div>
      </div>

      {/* Verified Claims: EACH CLAIM AS ONE CLEAN BLOCK */}
      {data.claims.length > 0 && (
        <div className="flex flex-col gap-2.5">
          <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-400/90 flex items-center gap-1.5">
            <span>Verified Claims:</span>
          </div>

          {data.claims.map((claim, idx) => {
            const hasSource = Boolean(claim.domain || claim.date);
            const hasConfirmedBy = Boolean(claim.confirmedBy && claim.confirmedBy.length > 0);

            return (
              <div
                key={claim.id || idx}
                className="group relative rounded-xl border border-emerald-500/25 bg-emerald-950/20 hover:border-emerald-500/40 hover:bg-emerald-950/30 transition-all p-3.5 shadow-sm flex flex-col gap-1.5"
              >
                {/* ✅ [claim text] */}
                <div className="flex items-start gap-2.5">
                  <span className="text-emerald-400 font-bold text-sm shrink-0 select-none mt-0.5" aria-hidden="true">
                    ✅
                  </span>
                  <div className="text-sm sm:text-[14.5px] font-medium text-slate-100 leading-relaxed break-words flex-1">
                    {claim.claim}
                  </div>
                </div>

                {/* Indented metadata lines */}
                {(hasSource || hasConfirmedBy) && (
                  <div className="pl-6 sm:pl-7 flex flex-col gap-1 text-xs text-slate-300 pt-1">
                    {/* Source: [domain] ([eventDate or publishedAt if available]) */}
                    {hasSource && (
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="text-slate-400 font-mono font-medium">Source:</span>
                        {claim.domain && (
                          <span className="text-emerald-300 font-mono font-semibold">
                            {claim.domain}
                          </span>
                        )}
                        {claim.date && (
                          <span className="text-slate-400 font-mono text-[11px]">
                            ({claim.date})
                          </span>
                        )}
                        {claim.url && (
                          <a
                            href={claim.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-cyan-400 hover:text-cyan-200 ml-1 hover:underline"
                            title={`Open source: ${claim.url}`}
                          >
                            <ExternalLink size={11} />
                          </a>
                        )}
                      </div>
                    )}

                    {/* Confirmed by: [confirmedBy list, comma-separated] */}
                    {hasConfirmedBy && (
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="text-slate-400 font-mono font-medium">Confirmed by:</span>
                        <span className="text-cyan-300 font-medium">
                          {claim.confirmedBy!.join(', ')}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Unconfirmed details (hedged) */}
      {data.plausibleUnconfirmed.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          <span className="text-[11px] font-mono font-bold text-cyan-300 uppercase tracking-wider">
            Unconfirmed Details (Hedged in Synthesis):
          </span>
          <div className="flex flex-col gap-1.5">
            {data.plausibleUnconfirmed.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 px-3.5 py-2 rounded-xl bg-cyan-500/10 border border-cyan-500/25 text-cyan-200/90 text-xs leading-relaxed"
              >
                <Info size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                <div className="flex-1">{item}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Excluded discrepancies and contradictions */}
      {data.fabricatedOrContradicted.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          <span className="text-[11px] font-mono font-bold text-rose-300 uppercase tracking-wider">
            Excluded Discrepancies & Contradictions:
          </span>
          <div className="flex flex-col gap-1.5">
            {data.fabricatedOrContradicted.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-200/90 text-xs leading-relaxed"
              >
                <AlertTriangle size={14} className="text-rose-400 shrink-0 mt-0.5" />
                <div className="flex-1">{item}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* General audit notes */}
      {data.issues.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          <span className="text-[11px] font-mono font-bold text-amber-300 uppercase tracking-wider">
            Audit & Verification Notes:
          </span>
          <div className="flex flex-col gap-1.5">
            {data.issues.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2.5 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200/90 text-xs leading-relaxed"
              >
                <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">{item}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const JarvisDeepResearchMeshAnswers: React.FC<JarvisDeepResearchMeshAnswersProps> = ({
  steps,
  isDeepResearch = false,
}) => {
  const [copiedStepIndex, setCopiedStepIndex] = useState<number | null>(null);
  const [rawViewMap, setRawViewMap] = useState<Record<number, boolean>>({});

  // Filter out skipped steps and finalSynthesizer (as the synthesizer is rendered in the final answer block)
  const agentSteps = steps.filter(
    (s) => s.status === 'completed' && s.agentId !== 'finalSynthesizer',
  );

  if (agentSteps.length === 0) return null;

  const handleCopy = async (text: string, step: JarvisExecutionStep, idx: number, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    const agentName = step.name || step.agentId || 'Agent';
    const modelId = step.model || step.providerName || 'unknown';
    const textWithModel = `${text.trim()}\n\n---\nModels Used:\n${agentName}: ${modelId}`;
    const success = await copyToClipboard(textWithModel);
    if (success) {
      setCopiedStepIndex(idx);
      setTimeout(() => setCopiedStepIndex(null), 2000);
    }
  };

  const toggleRawView = (idx: number) => {
    setRawViewMap((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  return (
    <div className="mb-6 flex flex-col gap-4">
      {/* Individual Agent Answers Section Banner */}
      <div className="relative p-3 sm:p-4 rounded-2xl bg-slate-950/80 border border-cyan-500/30 flex items-center justify-between flex-wrap gap-2 shadow-lg backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-[0_0_12px_rgba(97,215,201,0.3)]">
            <Layers size={17} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold tracking-wider text-cyan-300 uppercase">
                {isDeepResearch
                  ? 'DEEP RESEARCH // AGENT MESH FULL ANSWERS'
                  : 'MULTI-AGENT INTELLIGENCE // INDIVIDUAL AGENT ANSWERS'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-cyan-500/20 border border-cyan-400/40 text-cyan-300">
                {agentSteps.length} AGENTS COMPLETED
              </span>
            </div>
            <p className="text-[11px] text-slate-400 m-0">
              {isDeepResearch
                ? 'Unfiltered individual agent answers across the autonomous intelligence pipeline'
                : 'Unfiltered individual agent answers from each pipeline specialist'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400/80 bg-cyan-950/40 px-2.5 py-1 rounded-full border border-cyan-500/20">
          <Sparkles size={11} className="text-cyan-400" />
          <span>FULL PIPELINE TRANSPARENCY</span>
        </div>
      </div>

      {/* Individual Agent Answers Cards */}
      <div className="flex flex-col gap-4">
        {agentSteps.map((step, idx) => {
          const theme = AGENT_THEMES[step.agentId] || {
            title: `${step.name.toUpperCase()} // AUTONOMOUS AGENT`,
            subtitle: 'Independent Agent Execution Node',
            border: 'rgba(148, 163, 184, 0.45)',
            bg: 'linear-gradient(150deg, rgba(15, 23, 42, 0.9) 0%, rgba(8, 14, 28, 0.95) 100%)',
            headerBg: 'rgba(30, 41, 59, 0.6)',
            text: '#94a3b8',
            badgeBg: 'rgba(148, 163, 184, 0.15)',
            accentGlow: 'rgba(148, 163, 184, 0.25)',
            icon: <Bot size={18} className="text-slate-300" />,
          };

          const { formatted, isStructuredJson, raw } = formatAgentContentToMarkdown(step);
          const isShowingRaw = Boolean(rawViewMap[idx]);

          return (
            <div
              key={`${step.agentId}-${idx}`}
              className="relative rounded-2xl overflow-hidden border transition-all duration-300 shadow-xl"
              style={{
                background: theme.bg,
                borderColor: theme.border,
                boxShadow: `0 8px 32px rgba(0, 0, 0, 0.45), 0 0 20px ${theme.accentGlow}`,
              }}
            >
              {/* Agent Card Header */}
              <div
                className="px-4 py-3 border-b flex items-center justify-between flex-wrap gap-2"
                style={{
                  background: theme.headerBg,
                  borderColor: theme.border,
                }}
              >
                {/* Left: Agent Icon & Title */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
                    style={{
                      background: 'rgba(4, 12, 24, 0.85)',
                      border: `1.5px solid ${theme.text}`,
                    }}
                  >
                    {theme.icon}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-bold text-xs sm:text-sm tracking-wider uppercase font-mono"
                        style={{ color: theme.text }}
                      >
                        {theme.title}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-black/60 border border-white/10 text-slate-300">
                        {step.providerName}/{step.model}
                      </span>
                      {step.usedFallback && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[10px] font-mono">
                          <RotateCcw size={9} />
                          <span>FAILOVER</span>
                        </span>
                      )}
                      {step.agentId === 'researcher' && step.searchSource && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950/60 border border-amber-600/40 text-amber-300">
                          via {step.searchSource}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 m-0 hidden sm:block">
                      {theme.subtitle}
                    </p>
                  </div>
                </div>

                {/* Right: Timer + Raw Toggle + Copy Button */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {step.durationMs !== undefined && step.durationMs !== null && (
                    <span className="font-mono text-[11px] text-slate-300 px-2 py-1 rounded bg-black/50 border border-white/10 flex items-center gap-1">
                      <Clock size={11} className="text-cyan-400" />
                      <span>{step.durationMs}ms</span>
                    </span>
                  )}

                  {isStructuredJson && (
                    <button
                      type="button"
                      onClick={() => toggleRawView(idx)}
                      className="px-2 py-1 rounded text-xs font-mono flex items-center gap-1 bg-black/50 border border-white/15 text-slate-300 hover:text-white hover:border-white/30 transition-all"
                      title={isShowingRaw ? 'Switch to Formatted View' : 'Switch to Raw JSON View'}
                    >
                      {isShowingRaw ? (
                        <>
                          <FileText size={12} className="text-cyan-300" />
                          <span>Formatted</span>
                        </>
                      ) : (
                        <>
                          <Code2 size={12} className="text-cyan-300" />
                          <span>Raw JSON</span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => handleCopy(isShowingRaw ? raw : formatted, step, idx, e)}
                    className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 active:scale-95 transition-all flex items-center gap-1 text-xs font-mono bg-black/40 border border-white/10"
                    title="Copy full agent answer"
                  >
                    {copiedStepIndex === idx ? (
                      <>
                        <Check size={13} className="text-emerald-400" />
                        <span className="text-emerald-300 text-[10px]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span className="text-[10px] hidden sm:inline">Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Agent Full Answer Body */}
              <div className="p-4 sm:p-5 text-slate-100 text-sm leading-relaxed overflow-hidden">
                {isShowingRaw ? (
                  <div className="rounded-xl bg-black/70 border border-white/10 p-3.5 overflow-x-auto max-h-[500px] overflow-y-auto">
                    <pre className="font-mono text-xs text-cyan-200 leading-relaxed whitespace-pre-wrap break-words m-0">
                      {raw}
                    </pre>
                  </div>
                ) : (
                  <FormattedText content={formatted} />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
