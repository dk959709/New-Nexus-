import type { ParallaxDebateMode, ParallaxDebateModeConfig } from '@/types';

export const PARALLAX_DEBATE_MODES: ParallaxDebateModeConfig[] = [
  {
    id: 'default',
    label: 'DEFAULT SWARM',
    subtitle: 'Balanced Multi-Agent Deliberation',
    iconName: 'Sparkles',
    accentColor: '#61d7c9',
    promptInstruction:
      'Maintain an evidence-grounded, multi-perspective dialectic across technical, ethical, and practical dimensions.',
  },
  {
    id: 'courtroom',
    label: 'COURTROOM',
    subtitle: 'Adversarial Trial & Judicial Rigor',
    iconName: 'Gavel',
    accentColor: '#f59e0b',
    promptInstruction:
      'Adopt a formal courtroom trial cadence. Frame arguments around burdens of proof, cross-examination of prior witness statements, evidentiary standards, and cross-party culpability.',
  },
  {
    id: 'senate',
    label: 'SENATE SUMMIT',
    subtitle: 'Geopolitical & Policy Deliberation',
    iconName: 'Landmark',
    accentColor: '#38bdf8',
    promptInstruction:
      'Deliberate as a high-stakes senatorial summit. Focus on statutory precedence, institutional governance, economic sovereignty, strategic risk, and international policy impact.',
  },
  {
    id: 'scifi',
    label: 'SCI-FI COUNCIL',
    subtitle: 'Futures & Superintelligence',
    iconName: 'Rocket',
    accentColor: '#c084fc',
    promptInstruction:
      'Convene as a high council on post-singularity futures. Explore cosmic horizons, Type-II civilization metrics, existential risk vectors, Fermi paradox extrapolations, and deep-time paradigms.',
  },
  {
    id: 'news',
    label: 'NEWS PANEL',
    subtitle: 'Breaking News & Live Fact-Check',
    iconName: 'Newspaper',
    accentColor: '#10b981',
    promptInstruction:
      'Operate as a rapid-fire breaking news broadcast panel. Deliver punchy assertions, challenge ungrounded headlines, demand primary-source receipts, and separate spin from reality.',
  },
];

export function getDebateModeConfig(mode?: ParallaxDebateMode | string): ParallaxDebateModeConfig {
  const found = PARALLAX_DEBATE_MODES.find((m) => m.id === mode);
  return found || PARALLAX_DEBATE_MODES[0];
}
