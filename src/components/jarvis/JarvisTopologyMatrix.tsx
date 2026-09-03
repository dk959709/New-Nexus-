import { useState } from 'react';
import {
  Compass,
  Search,
  ShieldCheck,
  Lightbulb,
  Microscope,
  Sparkles,
  Layers,
  BarChart3,
  Cpu,
  ArrowRight,
  Zap,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import type { JarvisAgentId, JarvisExecutionStep, JarvisSystemConfig } from '@/types';

interface JarvisTopologyMatrixProps {
  config: JarvisSystemConfig;
  activeSteps?: JarvisExecutionStep[];
  onOpenSettings?: () => void;
  onSelectPrompt?: (prompt: string) => void;
}

const AGENTS_META: Array<{
  role: JarvisAgentId;
  name: string;
  emoji: string;
  icon: typeof Compass;
  color: string;
  description: string;
  detailedPurpose: string;
  sampleQuery: string;
}> = [
  {
    role: 'planner',
    name: 'PLANNER',
    emoji: '🧭',
    icon: Compass,
    color: '#61d7c9',
    description: 'Decomposes complex requests & routes agent tasks',
    detailedPurpose: 'Analyzes user prompts, identifies knowledge gaps, generates a structured execution plan, and decides which downstream agents are required.',
    sampleQuery: 'Design a step-by-step migration plan from a monolithic Rails backend to Go microservices.',
  },
  {
    role: 'researcher',
    name: 'RESEARCHER',
    emoji: '🔎',
    icon: Search,
    color: '#d99b64',
    description: 'Fetches grounded real-time search & Wiki data',
    detailedPurpose: 'Executes live web search and Wikipedia queries, gathers factual citations, extracts data snippets, and compiles rich background context.',
    sampleQuery: 'What are the newest discoveries confirmed by the James Webb Space Telescope in 2025/2026?',
  },
  {
    role: 'factChecker',
    name: 'FACT CHECKER',
    emoji: '🛡️',
    icon: ShieldCheck,
    color: '#a855f7',
    description: 'Validates claims & eliminates hallucinations',
    detailedPurpose: 'Scrutinizes intermediate research notes, audits numbers, dates, and claims against verified sources, tagging any discrepancies.',
    sampleQuery: 'Fact check the claims that humans only use 10% of their brains.',
  },
  {
    role: 'advisor',
    name: 'ADVISOR',
    emoji: '💡',
    icon: Lightbulb,
    color: '#facc15',
    description: 'Provides reasoned trade-offs, conceptual comparisons & verdicts',
    detailedPurpose: 'Interprets verified facts to evaluate comparisons, weigh pros and cons, build structural ASCII diagrams or tables, and provide reasoned recommendations.',
    sampleQuery: 'Compare PostgreSQL and MongoDB, which is better for a financial ledger?',
  },
  {
    role: 'reviewer',
    name: 'REVIEWER',
    emoji: '🔬',
    icon: Microscope,
    color: '#f1b66f',
    description: 'Refines coherence, logic & argument depth',
    detailedPurpose: 'Reviews the synthesized findings for completeness, logical flow, structural clarity, and executive readiness.',
    sampleQuery: 'Review the economic trade-offs between universal basic income and targeted negative income tax.',
  },
  {
    role: 'finalSynthesizer',
    name: 'SYNTHESIZER',
    emoji: '✨',
    icon: Sparkles,
    color: '#34d399',
    description: 'Outputs pristine, executive final response',
    detailedPurpose: 'Transforms verified findings into a beautifully structured, comprehensive response for the user with zero internal reasoning leaks.',
    sampleQuery: 'Synthesize a definitive executive briefing on commercial fusion reactor timelines.',
  },
  {
    role: 'architect',
    name: 'ARCHITECT',
    emoji: '🏗️',
    icon: Layers,
    color: '#f59e0b',
    description: 'Generates precision vector SVG blueprints & diagrams',
    detailedPurpose: 'Engaged in Diagram Mode for structural or process concepts to produce sleek, dark-themed SVG architecture diagrams and workflow charts.',
    sampleQuery: 'Explain the event-driven microservices architecture with a visual diagram.',
  },
  {
    role: 'dataAnalyst',
    name: 'DATA ANALYST',
    emoji: '📊',
    icon: BarChart3,
    color: '#38bdf8',
    description: 'Extracts comparative statistics & renders responsive charts',
    detailedPurpose: 'Engaged in Chart Mode for queries involving numerical datasets, statistics, or trend comparisons to extract metrics and render interactive charts.',
    sampleQuery: 'Compare the orbital payload capacities and launch costs of Falcon 9, Starship, and New Glenn.',
  },
];

export function JarvisTopologyMatrix({
  config,
  activeSteps = [],
  onOpenSettings,
  onSelectPrompt,
}: JarvisTopologyMatrixProps) {
  const [selectedAgent, setSelectedAgent] = useState<JarvisAgentId>('planner');

  const selectedAgentMeta = AGENTS_META.find((a) => a.role === selectedAgent) || AGENTS_META[0];
  const selectedAgentConfig = config?.agents?.[selectedAgent] || config?.agents?.planner;

  return (
    <div
      className="jarvis-hud-card jarvis-corner-brackets"
      style={{
        padding: '24px',
        marginBottom: '20px',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={18} className="text-accent" />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#fff' }}>
              6-Agent Neural Pipeline Topology
            </h3>
            <span
              style={{
                fontSize: '11px',
                fontFamily: 'DM Mono',
                background: 'rgba(97,215,201,0.15)',
                color: 'var(--accent)',
                padding: '2px 8px',
                borderRadius: '4px',
                fontWeight: 600,
                border: '1px solid rgba(97,215,201,0.3)',
              }}
            >
              INTERACTIVE
            </span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
            Sequential multi-tier consensus mesh. Click any agent node to inspect its runtime parameters & model configurations.
          </p>
        </div>

        {onOpenSettings && (
          <button
            type="button"
            onClick={onOpenSettings}
            style={{
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Zap size={13} className="text-accent" />
            <span>Customize Weights</span>
          </button>
        )}
      </div>

      {/* 5-Node Interactive Grid with Laser Flow */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '12px',
          position: 'relative',
          marginBottom: '20px',
        }}
      >
        {AGENTS_META.map((meta, index) => {
          const agentConf = config?.agents?.[meta.role];
          const isSelected = selectedAgent === meta.role;
          const liveStep = activeSteps.find((s) => s.agentId === meta.role);
          const isRunningStep = liveStep?.status === 'running';
          const isCompletedStep = liveStep?.status === 'completed';
          const isEnabled = agentConf?.enabled ?? true;
          const IconComp = meta.icon;

          return (
            <div
              key={meta.role}
              onClick={() => setSelectedAgent(meta.role)}
              style={{
                position: 'relative',
                padding: '14px',
                borderRadius: '12px',
                background: isSelected
                  ? 'linear-gradient(135deg, rgba(14,34,50,0.95) 0%, rgba(20,30,60,0.95) 100%)'
                  : 'rgba(6,16,24,0.65)',
                border: isSelected
                  ? `1.5px solid ${meta.color}`
                  : isRunningStep
                  ? `1.5px solid ${meta.color}`
                  : '1px solid rgba(165,207,214,0.18)',
                boxShadow: isSelected
                  ? `0 8px 24px rgba(0,0,0,0.5), 0 0 16px ${meta.color}40`
                  : isRunningStep
                  ? `0 0 20px ${meta.color}60`
                  : 'none',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            >
              {/* Step Sequence Badge */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'DM Mono',
                    fontWeight: 800,
                    color: meta.color,
                    background: `${meta.color}20`,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    border: `1px solid ${meta.color}40`,
                  }}
                >
                  NODE 0{index + 1}
                </span>

                {isRunningStep ? (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '10px',
                      color: meta.color,
                      fontWeight: 700,
                      animation: 'jarvisCorePulse 1.2s infinite',
                    }}
                  >
                    <Clock size={10} /> RUNNING
                  </span>
                ) : isCompletedStep ? (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '10px',
                      color: '#34d399',
                      fontWeight: 700,
                    }}
                  >
                    <CheckCircle2 size={11} /> DONE
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '10px',
                      color: isEnabled ? 'var(--muted)' : '#ed8b8b',
                    }}
                  >
                    {isEnabled ? 'ONLINE' : 'MUTED'}
                  </span>
                )}
              </div>

              {/* Icon & Title */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <div
                  style={{
                    width: '30px',
                    height: '30px',
                    borderRadius: '8px',
                    background: `${meta.color}20`,
                    border: `1px solid ${meta.color}50`,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <IconComp size={16} style={{ color: meta.color }} />
                </div>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>
                    {meta.name}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'DM Mono' }}>
                    {agentConf?.modelId || agentConf?.providerId || 'Adaptive'}
                  </div>
                </div>
              </div>

              <p style={{ margin: '6px 0 0', fontSize: '11px', color: 'var(--muted)', lineHeight: '1.4' }}>
                {meta.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Selected Node Detailed Inspector */}
      <div
        style={{
          padding: '16px',
          borderRadius: '12px',
          background: 'rgba(5,14,22,0.85)',
          border: `1px solid ${selectedAgentMeta.color}40`,
          boxShadow: `inset 0 0 16px ${selectedAgentMeta.color}15`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>{selectedAgentMeta.emoji}</span>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#fff' }}>
                  Node Inspector: {selectedAgentMeta.name}
                </h4>
                <span
                  style={{
                    fontSize: '10px',
                    fontFamily: 'DM Mono',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    background: `${selectedAgentMeta.color}25`,
                    color: selectedAgentMeta.color,
                    fontWeight: 700,
                  }}
                >
                  STATUS: {selectedAgentConfig?.enabled !== false ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>
              <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--muted)' }}>
                {selectedAgentMeta.detailedPurpose}
              </p>
            </div>
          </div>

          {onSelectPrompt && (
            <button
              type="button"
              onClick={() => onSelectPrompt(selectedAgentMeta.sampleQuery)}
              style={{
                padding: '6px 12px',
                borderRadius: '6px',
                background: `linear-gradient(135deg, ${selectedAgentMeta.color}30 0%, ${selectedAgentMeta.color}15 100%)`,
                border: `1px solid ${selectedAgentMeta.color}50`,
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span>Test Prompt</span>
              <ArrowRight size={12} />
            </button>
          )}
        </div>

        {/* Node Telemetry Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '8px', fontSize: '11px', fontFamily: 'DM Mono' }}>
          <div style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ color: 'var(--muted)' }}>PRIMARY PROVIDER:</span>
            <div style={{ color: '#fff', fontWeight: 700, marginTop: '2px' }}>
              {(selectedAgentConfig?.providerId || 'gemini').toUpperCase()}
            </div>
          </div>

          <div style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ color: 'var(--muted)' }}>PRIMARY MODEL:</span>
            <div style={{ color: selectedAgentMeta.color, fontWeight: 700, marginTop: '2px' }}>
              {selectedAgentConfig?.modelId || 'Adaptive Core'}
            </div>
          </div>

          <div style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ color: 'var(--muted)' }}>TOKEN ALLOCATION:</span>
            <div style={{ color: '#fff', fontWeight: 700, marginTop: '2px' }}>
              {selectedAgentConfig?.maxTokens || 4096} TOKENS
            </div>
          </div>

          <div style={{ padding: '8px', borderRadius: '6px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ color: 'var(--muted)' }}>FAILOVER REDUNDANCY:</span>
            <div style={{ color: selectedAgentConfig?.enableFailover ? '#34d399' : 'var(--muted)', fontWeight: 700, marginTop: '2px' }}>
              {selectedAgentConfig?.enableFailover ? (selectedAgentConfig.fallbackProviderId?.toUpperCase() || 'ENABLED') : 'NONE'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
