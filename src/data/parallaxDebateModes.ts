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
    id: 'genesis',
    label: 'GENESIS SWARM',
    subtitle: 'Self-Building Swarm · Auto Agents · 1 Round',
    iconName: 'Orbit',
    accentColor: '#a78bfa',
    promptInstruction:
      'Autonomously assemble 18 specialized agents tailored to the topic, ground each with web search in a single round, and synthesize a comprehensive final answer.',
  },
  {
    id: 'courtroom',
    label: 'COURTROOM TRIAL',
    subtitle: 'Prosecution vs Defense · Judicial Verdict',
    iconName: 'Gavel',
    accentColor: '#f59e0b',
    promptInstruction:
      'Adopt a formal courtroom trial cadence. Frame arguments around burdens of proof, cross-examination of prior witness statements, evidentiary standards, and cross-party culpability.',
    refereeId: 'nexus9',
    resultTitle: 'Verdict',
    sides: [
      {
        id: 'prosecution',
        label: 'Prosecution',
        color: '#f43f5e',
        instruction:
          'Argue the proposition is flawed, harmful, or false; demand rigorous empirical proof and expose liabilities.',
      },
      {
        id: 'defense',
        label: 'Defense',
        color: '#38bdf8',
        instruction:
          'Argue the proposition is sound, viable, or acceptable; establish reasonable doubt against criticism and highlight safeguards.',
      },
      {
        id: 'judge',
        label: 'Judge',
        color: '#f59e0b',
        instruction:
          'Preside as the impartial Judge weighing evidentiary burden of proof between Prosecution and Defense.',
      },
    ],
    roundInstructions: {
      1: 'Deliver your opening courtroom statement from your assigned side.',
      2: 'Cross-examine a witness from the OPPOSING side by @name and challenge their claim.',
      3: 'Deliver your closing argument. If you are the Judge, you MUST start your message with "VERDICT: UPHELD" or "VERDICT: NOT UPHELD" or "VERDICT: PARTIALLY UPHELD" followed by one sentence of reasoning.',
    },
  },
  {
    id: 'red_vs_blue',
    label: 'RED VS BLUE TEAM',
    subtitle: 'Adversarial Stress-Test & Mitigation',
    iconName: 'Shield',
    accentColor: '#ef4444',
    promptInstruction:
      'Operate as an adversarial Red Team vs Blue Team cybersecurity and systems stress-test. Red Team probes failure modes and exploits; Blue Team engineers resilient defenses and concrete fixes.',
    refereeId: 'nexus9',
    resultTitle: 'Result',
    sides: [
      {
        id: 'red',
        label: 'Red Team',
        color: '#ef4444',
        instruction:
          'Attack the idea, uncover critical failure modes, exploits, bottlenecks, and worst-case scenarios.',
      },
      {
        id: 'blue',
        label: 'Blue Team',
        color: '#3b82f6',
        instruction:
          'Defend the architecture, mitigate risks, and provide concrete engineering or policy fixes.',
      },
      {
        id: 'referee',
        label: 'Referee',
        color: '#a855f7',
        instruction:
          'Act as the neutral adversarial Referee scoring Red Team attacks against Blue Team mitigations.',
      },
    ],
    roundInstructions: {
      1: 'Red Team names its strongest attack vector; Blue Team names its strongest defense mechanism.',
      2: 'Directly challenge a member of the opposing team by @name.',
      3: 'Red Team states the most dangerous unresolved weakness and includes "SEVERITY: n/5"; Blue Team states the best concrete fix; the Referee MUST start with "RESULT: RED WINS" or "RESULT: BLUE WINS" or "RESULT: DRAW" plus one sentence.',
    },
  },
  {
    id: 'senate',
    label: 'SENATE SUMMIT',
    subtitle: 'Faction Floor Debate & Roll-Call Vote',
    iconName: 'Landmark',
    accentColor: '#38bdf8',
    promptInstruction:
      'Deliberate as a high-stakes senatorial summit. Focus on statutory precedence, institutional governance, economic sovereignty, strategic risk, and international policy impact.',
    resultTitle: 'Vote',
    sides: [
      {
        id: 'security',
        label: 'Security Hawks',
        color: '#f43f5e',
        instruction:
          'Prioritize national and systemic security, resilience, deterrence, and sovereign risk containment.',
      },
      {
        id: 'innovation',
        label: 'Innovation Bloc',
        color: '#06b6d4',
        instruction:
          'Champion technological acceleration, R&D leadership, open competition, and breakthrough capability.',
      },
      {
        id: 'economy',
        label: 'Economic Council',
        color: '#f59e0b',
        instruction:
          'Focus on fiscal sustainability, capital efficiency, labor markets, productivity, and trade balance.',
      },
      {
        id: 'ethics',
        label: 'Ethics & Public Interest',
        color: '#10b981',
        instruction:
          'Safeguard civil liberties, equitable access, democratic accountability, and human welfare.',
      },
    ],
    roundInstructions: {
      1: 'Deliver a concise senate floor statement from your faction’s viewpoint.',
      2: 'Rebut a senator from a DIFFERENT faction by @name.',
      3: 'Cast your final roll-call vote: start your message with "VOTE: AYE" or "VOTE: NAY" or "VOTE: ABSTAIN" followed by one sentence.',
    },
  },
  {
    id: 'vc_pitch',
    label: 'VENTURE PITCH COMMITTEE',
    subtitle: 'Capital Diligence & Investment Decision',
    iconName: 'Briefcase',
    accentColor: '#10b981',
    promptInstruction:
      'Convene as an institutional Venture Capital Investment Committee evaluating market size, technical moat, unit economics, and execution risk.',
    resultTitle: 'Decision',
    sides: [
      {
        id: 'market',
        label: 'Market Partner',
        color: '#38bdf8',
        instruction:
          'Evaluate total addressable market (TAM), adoption velocity, customer distribution, and competitive timing.',
      },
      {
        id: 'tech',
        label: 'Tech Partner',
        color: '#a855f7',
        instruction:
          'Scrutinize technical feasibility, defensible IP moat, architecture scalability, and engineering bottlenecks.',
      },
      {
        id: 'finance',
        label: 'Finance Partner',
        color: '#10b981',
        instruction:
          'Analyze unit economics, capital intensity, margin structure, burn multiple, and return profile.',
      },
      {
        id: 'risk',
        label: 'Risk Partner',
        color: '#f59e0b',
        instruction:
          'Stress-test regulatory exposure, downside tail risks, governance, and existential deal-breakers.',
      },
    ],
    roundInstructions: {
      1: 'State your initial partner diligence assessment on the opportunity from your role.',
      2: 'Challenge another partner from a different role by @name.',
      3: 'Deliver your final investment committee call: start your message with "DECISION: INVEST" or "DECISION: PASS" or "DECISION: CONDITIONAL" followed by one sentence.',
    },
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

