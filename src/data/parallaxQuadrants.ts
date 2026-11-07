// Categorization of the 20 agents into 4 ideological quadrants + Core Anchors
export interface AgentQuadrantInfo {
  quadrant: 'optimists' | 'realists' | 'ethicists' | 'visionaries' | 'anchors';
  label: string;
  quadrantName: string;
  x: number; // percentage in 2D plot (0-100)
  y: number; // percentage in 2D plot (0-100)
  angle: number; // degrees around orbit (0-360)
}

export const AGENT_QUADRANTS: Record<string, AgentQuadrantInfo> = {
  // Systems Optimists (Top Right)
  aurora: { quadrant: 'optimists', label: 'Optimist', quadrantName: 'Techno-Optimism', x: 80, y: 25, angle: 18 },
  axiom: { quadrant: 'optimists', label: 'Deductive Logic', quadrantName: 'Techno-Optimism', x: 70, y: 15, angle: 36 },
  cipher: { quadrant: 'optimists', label: 'Systems Engineering', quadrantName: 'Techno-Optimism', x: 88, y: 38, angle: 54 },
  catalyst: { quadrant: 'optimists', label: 'Disruption & Horizons', quadrantName: 'Techno-Optimism', x: 68, y: 35, angle: 72 },

  // Visionaries & Culture (Bottom Right)
  pixel: { quadrant: 'visionaries', label: 'Aesthetics & Culture', quadrantName: 'Creative Vision', x: 82, y: 72, angle: 90 },
  nomad: { quadrant: 'visionaries', label: 'Global Pluralism', quadrantName: 'Creative Vision', x: 72, y: 84, angle: 108 },
  oracle: { quadrant: 'visionaries', label: 'Predictive Scenarios', quadrantName: 'Creative Vision', x: 88, y: 80, angle: 126 },
  ember: { quadrant: 'visionaries', label: 'Emotional Urgency', quadrantName: 'Creative Vision', x: 62, y: 75, angle: 144 },

  // Ethicists & Humanists (Bottom Left)
  socrates: { quadrant: 'ethicists', label: 'First Principles', quadrantName: 'Ethics & Philosophy', x: 32, y: 78, angle: 162 },
  harmony: { quadrant: 'ethicists', label: 'Human Dignity', quadrantName: 'Ethics & Philosophy', x: 20, y: 85, angle: 180 },
  lumen: { quadrant: 'ethicists', label: 'Demystifier', quadrantName: 'Ethics & Philosophy', x: 15, y: 68, angle: 198 },
  echo: { quadrant: 'ethicists', label: 'Public Pulse', quadrantName: 'Ethics & Philosophy', x: 35, y: 62, angle: 216 },

  // Critical Realists & Pragmatists (Top Left)
  gravity: { quadrant: 'realists', label: 'Logistical Friction', quadrantName: 'Critical Realism', x: 22, y: 32, angle: 234 },
  ledger: { quadrant: 'realists', label: 'Capital & Incentives', quadrantName: 'Critical Realism', x: 15, y: 18, angle: 252 },
  sentinel: { quadrant: 'realists', label: 'Tail Risk & Defense', quadrantName: 'Critical Realism', x: 34, y: 15, angle: 270 },
  vanguard: { quadrant: 'realists', label: 'Contrarian Pushback', quadrantName: 'Critical Realism', x: 38, y: 38, angle: 288 },

  // Core Anchors & Synthesizers (Center Orbit)
  veritas: { quadrant: 'anchors', label: 'Tool Grounded Truth', quadrantName: 'Core Synthesizers', x: 50, y: 30, angle: 306 },
  nexus9: { quadrant: 'anchors', label: 'Objective Synthesizer', quadrantName: 'Core Synthesizers', x: 50, y: 70, angle: 324 },
  chronos: { quadrant: 'anchors', label: 'Historical Precedent', quadrantName: 'Core Synthesizers', x: 38, y: 50, angle: 342 },
  mosaic: { quadrant: 'anchors', label: 'Interdisciplinary', quadrantName: 'Core Synthesizers', x: 62, y: 50, angle: 360 },
};
