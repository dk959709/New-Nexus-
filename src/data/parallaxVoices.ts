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

/**
 * Universal Formatted Transcript for Parallax Swarm:
 * Topic, then each round labeled (Round 1/2/3), each agent's name and message in order,
 * followed by the Parallax Summary (verdict, lean, highlights) at the end.
 */
export function formatFullParallaxTranscript(
  topic: string,
  messages: ParallaxMessage[],
  summary?: ParallaxSummary | null
): string {
  const cleanTopic = topic.trim() || 'Untitled Deliberation';
  let output = `=== PARALLAX 20-AGENT SWARM DELIBERATION ===\n\n`;
  output += `TOPIC: ${cleanTopic}\n\n`;

  for (let r = 1; r <= 3; r++) {
    output += `--- ROUND ${r} ---\n`;
    const roundMsgs = messages.filter((m) => m.round === r);
    if (roundMsgs.length === 0) {
      output += `(No responses recorded for Round ${r})\n\n`;
      continue;
    }
    for (const m of roundMsgs) {
      const toolNote = m.toolUsed ? ` [Verified Fact: ${m.toolUsed.query || 'Search'}]` : '';
      output += `${m.agentName}${toolNote}: "${m.text}"\n`;
    }
    output += '\n';
  }

  if (summary) {
    output += `--- PARALLAX SUMMARY ---\n`;
    output += `Verdict: ${summary.verdict}\n`;
    output += `Consensus Lean: ${summary.consensusLean}\n\n`;
    if (summary.highlights && summary.highlights.length > 0) {
      output += `Key Highlights:\n`;
      for (const hl of summary.highlights) {
        output += `• ${hl}\n`;
      }
      output += '\n';
    }
  }

  return output.trim();
}
