import type { ParallaxMessage, ParallaxSummary } from '@/types';

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
  summary?: ParallaxSummary | null
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

  let output = `${divider}\n`;
  output += `PARALLAX 20-AGENT SWARM DELIBERATION TRANSCRIPT\n`;
  output += `${divider}\n`;
  output += `TOPIC       : "${cleanTopic}"\n`;
  output += `DATE        : ${formattedDate}\n`;
  output += `TIME        : ${formattedTime}\n`;
  output += `SCALE       : 20 Autonomous Personas • 3 Rounds • ${messages.length} Total Contributions\n`;
  output += `${divider}\n\n\n`;

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
      const role = AGENT_ROLES[cleanId] || '';
      const moodStr = m.mood ? `  ${m.mood}` : '';
      const roleStr = role ? ` (${role})` : '';

      // Agent Header
      output += `[#${indexStr}] ${m.agentName}${moodStr}${roleStr}\n`;

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
        const queryOrFact = m.toolUsed.query || 'Verified Live Fact';
        metaTokens.push(`Live Tool: ${queryOrFact}`);
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

    output += `CONSENSUS LEAN:\n${summary.consensusLean}\n\n`;
    output += `SYNTHESIS VERDICT:\n${summary.verdict}\n\n`;

    if (summary.highlights && summary.highlights.length > 0) {
      output += `KEY DELIBERATION HIGHLIGHTS:\n`;
      for (const hl of summary.highlights) {
        output += `• ${hl}\n`;
      }
      output += `\n`;
    }

    output += `${divider}\n`;
    output += `END OF PARALLAX DELIBERATION TRANSCRIPT\n`;
    output += `${divider}\n`;
  }

  return output.trim();
}
