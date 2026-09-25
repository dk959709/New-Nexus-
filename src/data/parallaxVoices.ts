import type { ParallaxMessage, ParallaxSummary, ParallaxSpecialistDeliberation } from '@/types';

/**
 * 20 Distinct Microsoft Edge Neural Voices assigned to Parallax agents.
 * Curated with a balanced mix of 10 female / 10 male voices across
 * US, UK, Australia, Canada, and India accents matching each agent's persona.
 */
export const DEFAULT_PARALLAX_VOICES: Record<string, string> = {
  veritas: 'en-GB-RyanNeural', // Male, British - authoritative, rigorous fact-checker
  aurora: 'en-US-JennyNeural', // Female, US - warm, optimistic, uplifting
  chronos: 'en-GB-ThomasNeural', // Male, British - scholarly, historical narrator
  axiom: 'en-US-BrianNeural', // Male, US - crisp, analytical logician
  echo: 'en-US-AriaNeural', // Female, US - conversational, relatable public voice
  ledger: 'en-US-GuyNeural', // Male, US - corporate, financial strategist
  socrates: 'en-GB-OliverNeural', // Male, British - deep philosophical questioning
  pixel: 'en-US-AnaNeural', // Female, US - artistic, creative, expressive
  vanguard: 'en-US-ChristopherNeural', // Male, US - bold, gritty, contrarian pushback
  harmony: 'en-AU-NatashaNeural', // Female, Australian - gentle, ethical, compassionate
  cipher: 'en-US-EricNeural', // Male, US - technical, computational engineer
  nomad: 'en-IN-NeerjaNeural', // Female, Indian - international, global cultural perspective
  sentinel: 'en-US-SteffanNeural', // Male, US - vigilant, defensive security guardian
  lumen: 'en-CA-ClaraNeural', // Female, Canadian - bright, accessible, demystifying
  catalyst: 'en-US-TonyNeural', // Male, US - dynamic, fast-paced innovation driver
  gravity: 'en-AU-WilliamNeural', // Male, Australian - grounded, pragmatic realist
  mosaic: 'en-GB-SoniaNeural', // Female, British - witty, eclectic interdisciplinary thinker
  oracle: 'en-IN-PrabhatNeural', // Male, Indian - resonant, high-conviction predictor
  ember: 'en-US-SaraNeural', // Female, US - passionate, emotionally driven urgency
  nexus9: 'en-US-AndrewNeural', // Male, US - balanced, neutral synthesizer
};

export function getParallaxAgentVoice(agentId?: string, configuredVoice?: string): string {
  if (configuredVoice && configuredVoice.trim()) return configuredVoice.trim();
  if (!agentId) return 'en-US-JennyNeural';
  const cleanId = agentId.toLowerCase().replace(/[^a-z0-9]/g, '');
  return DEFAULT_PARALLAX_VOICES[cleanId] || 'en-US-JennyNeural';
}

const AGENT_ROLES: Record<string, string> = {
  veritas: 'Fact-based, skeptical analysis',
  aurora: 'Optimistic, opportunity-focused',
  chronos: 'Historical context & precedent',
  socrates: 'First-principles philosophical questioning',
  axiom: 'Pure mathematical & deductive logic',
  vanguard: 'Contrarian, stress-tests consensus',
  solon: 'Governance, ethics & institutional trust',
  nexus: 'Complex systems & second-order effects',
  pixel: 'Design, aesthetic & cultural culture',
  ledger: 'Economic incentives & financial realism',
  cipher: 'Cybersecurity, risk & adversarial threat',
  gaia: 'Ecological & planetary boundary impacts',
  nova: 'Exponential tech & radical disruption',
  harmony: 'Diplomatic, consensus-building mediation',
  zeno: 'Paradox analysis & theoretical limits',
  atlas: 'Geopolitical & global macro strategy',
  pulse: 'High-frequency market sentiment',
  zephyr: 'Anthropological & human empathy',
  kairos: 'Tactical execution & immediate timing',
  orion: 'Deep-time cosmic & existential outlook',
};

const ROUND_TITLES: Record<number, string> = {
  1: 'ROUND 1: INDEPENDENT OPENING ASSESSMENTS',
  2: 'ROUND 2: CROSS-EXAMINATION & CRITICAL REBUTTALS',
  3: 'ROUND 3: CONVERGENCE & FINAL SYNTHESIS',
};

/**
 * Universal Formatted Transcript for Parallax Swarm:
 * Cleanly spaced export format with comprehensive metadata, session and individual
 * date/time stamps, generous spacing between agent answers, and structured synthesis.
 */
export function formatFullParallaxTranscript(
  topic: string,
  messages: ParallaxMessage[],
  summary?: ParallaxSummary | null,
  specialistDeliberation?: ParallaxSpecialistDeliberation | null,
): string {
  const cleanTopic = topic.trim() || 'Untitled Deliberation';

  // Session date & time stamps
  const sessionTs = messages[0]?.timestamp || Date.now();
  const sessionDate = new Date(sessionTs);
  const formattedDate = sessionDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = sessionDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const divider = '='.repeat(80);
  const subDivider = '-'.repeat(80);

  const uniqueAgents = new Set(messages.map((m) => m.agentId)).size;
  const dynamicCount = new Set(messages.filter((m) => m.isDynamic).map((m) => m.agentId)).size;
  const coreCount = uniqueAgents - dynamicCount;
  const scaleLine = dynamicCount > 0
    ? `SCALE       : ${uniqueAgents} Autonomous Personas (${coreCount} Core + ${dynamicCount} Dynamic Specialists) • 3 Rounds • ${messages.length} Total Contributions\n`
    : `SCALE       : 20 Autonomous Personas • 3 Rounds • ${messages.length} Total Contributions\n`;

  let output = `${divider}\n`;
  output += `PARALLAX SWARM DELIBERATION TRANSCRIPT\n`;
  output += `${divider}\n`;
  output += `TOPIC       : "${cleanTopic}"\n`;
  output += `DATE        : ${formattedDate}\n`;
  output += `TIME        : ${formattedTime}\n`;
  output += scaleLine;
  output += `${divider}\n\n\n`;

  // Pre-Round Dynamic Specialist Deliberation (5-persona opinions + 3 compiled mandatory + invisible gap check)
  if (specialistDeliberation && (specialistDeliberation.opinions?.length > 0 || specialistDeliberation.selectedMandatory?.length > 0)) {
    output += `${divider}\n`;
    output += `PRE-ROUND: DYNAMIC SPECIALIST DELIBERATION\n`;
    output += `${divider}\n\n`;

    if (specialistDeliberation.opinions && specialistDeliberation.opinions.length > 0) {
      output += `5 CORE PERSONA SPECIALIST RECOMMENDATIONS:\n`;
      output += `${subDivider}\n`;
      specialistDeliberation.opinions.forEach((op, idx) => {
        const idxStr = String(idx + 1).padStart(2, '0');
        output += `[${idxStr}] ${op.agentName} ${op.emoji || ''} (${op.role})\n`;
        output += `     Suggested Specialist : ${op.suggestedSpecialist}\n`;
        output += `     Reason               : "${op.reason}"\n\n`;
      });
    }

    if (specialistDeliberation.selectedMandatory && specialistDeliberation.selectedMandatory.length > 0) {
      output += `COMPILED MANDATORY SPECIALISTS (Top 3 Distinct Picks):\n`;
      output += `${subDivider}\n`;
      if (specialistDeliberation.compilerReasoning) {
        output += `Compiler Strategy: ${specialistDeliberation.compilerReasoning}\n\n`;
      }
      specialistDeliberation.selectedMandatory.forEach((m, idx) => {
        output += `• [Mandatory #${idx + 1}] ${m.name} ${m.mood || '✨'} (${m.role}) [Dynamically Generated]\n`;
        if (m.selectionReason) {
          output += `  Selection Rationale: ${m.selectionReason}\n`;
        }
        output += `  Focus: ${m.systemInstruction}\n`;
      });
      output += '\n';
    }

    output += `ADDITIONAL SPECIALISTS (Invisible Topic-Analysis Gap System):\n`;
    output += `${subDivider}\n`;
    if (specialistDeliberation.additionalSpecialists && specialistDeliberation.additionalSpecialists.length > 0) {
      specialistDeliberation.additionalSpecialists.forEach((m, idx) => {
        output += `• [Additional #${idx + 1}] ${m.name} ${m.mood || '✨'} (${m.role}) [Dynamically Generated]\n`;
        output += `  Focus: ${m.systemInstruction}\n`;
      });
    } else {
      output += `• None required (Core 20 + 3 Mandatory Specialists achieve comprehensive domain coverage)\n`;
    }
    output += `\n${divider}\n\n\n`;
  }

  for (let r = 1; r <= 3; r++) {
    const roundTitle = ROUND_TITLES[r] || `ROUND ${r}`;
    output += `${divider}\n`;
    output += `${roundTitle}\n`;
    output += `${divider}\n\n`;

    const roundMsgs = messages.filter((m) => m.round === r);
    if (roundMsgs.length === 0) {
      output += `(No agent responses recorded for Round ${r})\n\n\n`;
      continue;
    }

    for (let idx = 0; idx < roundMsgs.length; idx++) {
      const m = roundMsgs[idx];
      const indexStr = String(idx + 1).padStart(2, '0');
      const cleanId = (m.agentId || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const role = m.role || AGENT_ROLES[cleanId] || (cleanId === 'veritas' ? 'Fact-based, skeptical analysis' : '');
      const moodStr = cleanId === 'veritas' ? ' 🧠' : (m.mood ? ` ${m.mood.trim()}` : '');
      const roleStr = role ? ` (${role})` : '';
      const dynamicBadge = m.isDynamic ? ' [Dynamically Generated]' : '';

      let liveSearchBadge = '';
      if (m.toolUsed) {
        if (m.toolUsed.failed) {
          liveSearchBadge = ' [Live Search: ⚠️ No results found]';
        } else {
          liveSearchBadge = ` [Live Search: ✅ ${m.toolUsed.searchSource || 'Tavily'}]`;
        }
      }

      // Agent Header: e.g. [#21] CLINICUS 🩺 (Clinical Ethics Specialist) [Dynamically Generated]
      output += `[#${indexStr}] ${m.agentName}${moodStr}${roleStr}${dynamicBadge}${liveSearchBadge}\n`;

      // Date & Time + Conviction + Tool Meta
      const metaTokens: string[] = [];

      if (m.timestamp) {
        const mDate = new Date(m.timestamp);
        if (!isNaN(mDate.getTime())) {
          const tStr = mDate.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
          });
          const dStr = mDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });
          metaTokens.push(`Time: ${tStr}`);
          metaTokens.push(`Date: ${dStr}`);
        }
      }

      if (m.conviction !== undefined) {
        metaTokens.push(`Conviction: ${m.conviction}/10`);
      }

      if (m.toolUsed) {
        if (m.toolUsed.failed) {
          metaTokens.push(`Live Tool: [Live Search: ⚠️ No results found for "${m.toolUsed.query || ''}"]`);
        } else {
          metaTokens.push(`Live Tool: [Live Search: ✅ ${m.toolUsed.searchSource || 'Live Web'} • ${m.toolUsed.sourcesCount ?? 1} sources for "${m.toolUsed.query || ''}"]`);
        }
      }

      if (metaTokens.length > 0) {
        output += `${metaTokens.join('  •  ')}\n`;
      }

      // Empty gap line before the agent's answer
      output += `\n"${m.text}"\n\n`;

      // Gap & divider between agent answers (only between items)
      if (idx < roundMsgs.length - 1) {
        output += `${subDivider}\n\n`;
      }
    }

    output += `\n\n`;
  }

  if (summary) {
    output += `${divider}\n`;
    output += `PARALLAX SWARM SYNTHESIS REPORT\n`;
    output += `${divider}\n\n`;

    if (summary.entityResolution && summary.entityResolution.canonicalEntity && summary.entityResolution.canonicalEntity.toLowerCase() !== topic.toLowerCase().trim()) {
      output += `RESOLVED ENTITY:\n"${summary.entityResolution.input}" -> "${summary.entityResolution.canonicalEntity}" (${summary.entityResolution.entityType}, ${Math.round(summary.entityResolution.confidence * 100)}% confidence)\n\n`;
    }

    if (summary.groundingLevel) {
      output += `GROUNDING LEVEL:\n${summary.groundingLevel}\n\n`;
    }

    if (summary.verifiedClaims && summary.verifiedClaims.length > 0) {
      output += `VERIFIED EMPIRICAL CLAIMS:\n`;
      for (const c of summary.verifiedClaims) {
        output += `• [${c.status}] ${c.claimText} (Confidence: ${Math.round(c.confidence * 100)}%)\n`;
        if (c.reasoning) {
          output += `  Evidentiary Basis: ${c.reasoning}\n`;
        }
      }
      output += `\n`;
    }

    if (summary.factualConflicts && summary.factualConflicts.length > 0) {
      output += `FACTUAL CONFLICTS DETECTED:\n`;
      for (const fc of summary.factualConflicts) {
        output += `• ${fc}\n`;
      }
      output += `\n`;
    }

    if (summary.valueConflicts && summary.valueConflicts.length > 0) {
      output += `VALUE & IDEOLOGICAL TENSIONS:\n`;
      for (const vc of summary.valueConflicts) {
        output += `• ${vc}\n`;
      }
      output += `\n`;
    }

    output += `CONSENSUS LEAN:\n${summary.consensusLean}\n\n`;
    output += `SYNTHESIS VERDICT:\n${summary.verdict}\n\n`;

    if (summary.highlights && summary.highlights.length > 0) {
      output += `KEY DELIBERATION HIGHLIGHTS:\n`;
      for (const hl of summary.highlights) {
        output += `• ${hl}\n`;
      }
      output += `\n`;
    }

    if (summary.evidenceSources && summary.evidenceSources.length > 0) {
      output += `EVIDENCE CITATIONS:\n`;
      for (const es of summary.evidenceSources) {
        output += `• "${es.title}" (${es.domain}) [Tier: ${es.tier.toUpperCase()}]\n  URL: ${es.url}\n`;
      }
      output += `\n`;
    }

    output += `${divider}\n`;
    output += `END OF PARALLAX DELIBERATION TRANSCRIPT\n`;
    output += `${divider}\n`;
  }

  return output.trim();
}
