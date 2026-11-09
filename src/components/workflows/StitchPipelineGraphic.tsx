import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Cpu,
  Boxes,
  Eye,
  Activity,
  Play,
  Pause,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Zap,
  CheckCircle2,
  Sliders,
  Layers,
  ArrowRight,
  ArrowDown,
} from 'lucide-react';

export interface StitchPipelineGraphicProps {
  className?: string;
  defaultExpanded?: boolean;
  onSelectNode?: (nodeKey: string) => void;
}

interface PipelineNode {
  id: string;
  key: string;
  title: string;
  subTitle: string;
  tag: string;
  accentColor: string;
  borderColor: string;
  glowColor: string;
  icon: React.ReactNode;
  specs: { label: string; value: string }[];
  status: 'idle' | 'active' | 'synced';
  description: string;
}

export const StitchPipelineGraphic: React.FC<StitchPipelineGraphicProps> = ({
  className = '',
  defaultExpanded = true,
  onSelectNode,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isSimulating, setIsSimulating] = useState(true);
  const [activeStep, setActiveStep] = useState(0);
  const [throughput, setThroughput] = useState(3420);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  // Live simulation ticker
  useEffect(() => {
    if (!isSimulating) return;

    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
      // Gentle jitter for telemetry throughput
      setThroughput(3200 + Math.floor(Math.random() * 450));
    }, 2200);

    return () => clearInterval(interval);
  }, [isSimulating]);

  const nodes: PipelineNode[] = [
    {
      id: 'node-ai-studio',
      key: 'ai-studio',
      title: 'AI Studio',
      subTitle: 'Model Ingestion & Seed',
      tag: 'SRC-01',
      accentColor: '#00f0ff',
      borderColor: 'border-[#00f0ff]/40',
      glowColor: 'rgba(0, 240, 255, 0.25)',
      icon: <Sparkles size={16} className="text-[#00f0ff]" />,
      description: 'Ingests prompts, multimodal assets, seed seeds, and context parameters.',
      specs: [
        { label: 'Prompt Tok', value: '142 / 1000' },
        { label: 'Seed Num', value: '#849204' },
        { label: 'Lat Ingest', value: '1024×1024' },
      ],
      status: activeStep === 0 ? 'active' : 'synced',
    },
    {
      id: 'node-agy-core',
      key: 'agy-core',
      title: 'Agy Core',
      subTitle: 'Inference Mesh & Reasoning',
      tag: 'CORE-CKPT',
      accentColor: '#818cf8',
      borderColor: 'border-[#818cf8]/40',
      glowColor: 'rgba(129, 140, 248, 0.25)',
      icon: <Cpu size={16} className="text-[#818cf8]" />,
      description: 'Orchestrates multi-agent routing, token weights, and latent tensor sampling.',
      specs: [
        { label: 'Checkpoint', value: 'FLUX.1-schnell' },
        { label: 'Sampler', value: 'Euler-Ancestral' },
        { label: 'Scheduler', value: 'Simple Karras' },
      ],
      status: activeStep === 1 ? 'active' : 'synced',
    },
    {
      id: 'node-stitch-engine',
      key: 'stitch-engine',
      title: 'Stitch Engine',
      subTitle: 'Design & UI Assembly',
      tag: 'STITCH-MESH',
      accentColor: '#34d399',
      borderColor: 'border-[#34d399]/40',
      glowColor: 'rgba(52, 211, 153, 0.25)',
      icon: <Boxes size={16} className="text-[#34d399]" />,
      description: 'Transforms cognitive tensors into cohesive UI systems and responsive components.',
      specs: [
        { label: 'Diff Iter', value: 'Step 24/28 (86%)' },
        { label: 'CFG Drift', value: '0.02%' },
        { label: 'Neural Mesh', value: 'UltraSharp-v2' },
      ],
      status: activeStep === 2 ? 'active' : 'synced',
    },
    {
      id: 'node-live-preview',
      key: 'live-preview',
      title: 'Live Preview',
      subTitle: 'Holographic Render',
      tag: 'OLED-RENDER',
      accentColor: '#f472b6',
      borderColor: 'border-[#f472b6]/40',
      glowColor: 'rgba(244, 114, 182, 0.25)',
      icon: <Eye size={16} className="text-[#f472b6]" />,
      description: 'Real-time holographic viewports with responsive scaling and live stream telemetry.',
      specs: [
        { label: 'Output Res', value: '4096×4096 32-bit' },
        { label: 'Throughput', value: `${throughput.toLocaleString()} tok/s` },
        { label: 'State', value: 'Render Ready' },
      ],
      status: activeStep === 3 ? 'active' : 'synced',
    },
  ];

  return (
    <div
      className={`w-full max-w-full overflow-hidden rounded-2xl bg-[#090d16]/95 border border-cyan-500/25 shadow-[0_12px_40px_rgba(0,0,0,0.65),0_0_24px_rgba(0,240,255,0.08)] backdrop-blur-xl mb-4 transition-all duration-300 ${className}`}
    >
      {/* Top Banner Control Strip */}
      <div className="w-full px-3.5 sm:px-5 py-2.5 border-b border-cyan-500/20 bg-[#060a12]/80 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex items-center justify-center w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.25)] shrink-0">
            <Zap size={14} className="text-cyan-400 animate-pulse" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-mono text-xs sm:text-sm font-bold tracking-tight text-white uppercase truncate">
                Stitch Pipeline Architecture
              </h3>
              <span className="hidden xs:inline-flex px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                LIVE MESH
              </span>
            </div>
            <p className="text-[11px] font-mono text-zinc-400 truncate">
              AI Studio <span className="text-cyan-400">→</span> Agy Core <span className="text-indigo-400">→</span> Stitch Engine <span className="text-emerald-400">→</span> Live Preview
            </p>
          </div>
        </div>

        {/* Right Action Chips */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          <button
            type="button"
            onClick={() => setIsSimulating((prev) => !prev)}
            className={`px-2.5 py-1 rounded-lg font-mono text-[11px] flex items-center gap-1.5 transition-all border ${
              isSimulating
                ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.2)]'
                : 'bg-zinc-900 border-zinc-700 text-zinc-400 hover:text-zinc-200'
            }`}
            title={isSimulating ? 'Pause live pulse simulation' : 'Start live pulse simulation'}
          >
            {isSimulating ? <Pause size={11} /> : <Play size={11} />}
            <span className="hidden sm:inline">{isSimulating ? 'Simulating' : 'Paused'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((prev) => !prev)}
            className="p-1 rounded-lg bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-400 hover:text-white transition-all"
            aria-label={isExpanded ? 'Collapse pipeline' : 'Expand pipeline'}
          >
            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {/* Main Collapsible Body: Mobile-First Stacked Grid */}
      {isExpanded && (
        <div className="p-3 sm:p-5 w-full overflow-hidden">
          {/* Telemetry Status Bar */}
          <div className="w-full mb-3.5 px-3 py-2 rounded-xl bg-[#0e1320]/80 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px]">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-zinc-300">
                <Activity size={12} className="text-emerald-400 animate-pulse" />
                <span>Stream Sync:</span>
                <span className="text-emerald-400 font-semibold">99.8%</span>
              </span>
              <span className="text-zinc-500">|</span>
              <span className="text-zinc-400">
                Throughput: <span className="text-cyan-300">{throughput.toLocaleString()} tok/s</span>
              </span>
            </div>
            <div className="flex items-center gap-2 text-zinc-400">
              <span className="inline-block w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
              <span>Pipeline Stage: <span className="text-cyan-300">{nodes[activeStep]?.title}</span></span>
            </div>
          </div>

          {/* Node Cards Container: Vertical Stack on Mobile (<sm), 2-col on Tablet, 4-col on Desktop */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5 relative">
            {nodes.map((node, index) => {
              const isActive = index === activeStep;
              const isSelected = selectedNode === node.key;

              return (
                <div
                  key={node.id}
                  onClick={() => {
                    setSelectedNode(node.key);
                    onSelectNode?.(node.key);
                  }}
                  className={`group relative rounded-xl p-3.5 flex flex-col justify-between transition-all duration-300 cursor-pointer overflow-hidden ${
                    isActive
                      ? 'bg-[#121828]/95 border-2 shadow-[0_0_20px_var(--glow)]'
                      : 'bg-[#0c111c]/80 border border-zinc-800/90 hover:border-zinc-700 hover:bg-[#101524]'
                  } ${isSelected ? 'ring-1 ring-cyan-400' : ''}`}
                  style={
                    {
                      borderColor: isActive ? node.accentColor : undefined,
                      '--glow': node.glowColor,
                    } as React.CSSProperties
                  }
                >
                  {/* Subtle top indicator glow strip */}
                  <div
                    className="absolute top-0 left-0 right-0 h-[2px] transition-opacity duration-300"
                    style={{
                      background: node.accentColor,
                      opacity: isActive ? 1 : 0.35,
                    }}
                  />

                  {/* Header Row: Icon + Title + Tag */}
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                          style={{
                            background: `${node.accentColor}18`,
                            borderColor: `${node.accentColor}40`,
                          }}
                        >
                          {node.icon}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-mono text-xs font-bold text-white tracking-wide truncate">
                            {node.title}
                          </h4>
                          <span className="text-[10px] font-mono text-zinc-400 block truncate">
                            {node.subTitle}
                          </span>
                        </div>
                      </div>

                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold tracking-wider border shrink-0"
                        style={{
                          color: node.accentColor,
                          background: `${node.accentColor}12`,
                          borderColor: `${node.accentColor}30`,
                        }}
                      >
                        {node.tag}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-300 line-clamp-2 leading-relaxed mb-3">
                      {node.description}
                    </p>
                  </div>

                  {/* Specs & Metrics Box */}
                  <div className="space-y-1.5 pt-2.5 border-t border-zinc-800/80 font-mono text-[10.5px]">
                    {node.specs.map((spec) => (
                      <div key={spec.label} className="flex items-center justify-between text-zinc-400">
                        <span className="text-zinc-500">{spec.label}:</span>
                        <span className="text-zinc-200 font-medium">{spec.value}</span>
                      </div>
                    ))}
                  </div>

                  {/* Active Indicator Footer */}
                  <div className="mt-3 pt-2 border-t border-zinc-800/60 flex items-center justify-between text-[10px] font-mono">
                    <span
                      className="flex items-center gap-1.5 font-semibold uppercase tracking-wider"
                      style={{ color: isActive ? node.accentColor : '#71717a' }}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${isActive ? 'animate-ping' : ''}`}
                        style={{ background: isActive ? node.accentColor : '#52525b' }}
                      />
                      {isActive ? 'Processing...' : 'Synced'}
                    </span>
                    <span className="text-zinc-500">Step 0{index + 1}</span>
                  </div>

                  {/* Mobile Downward Connection Indicator (between stacked cards) */}
                  {index < nodes.length - 1 && (
                    <div className="block sm:hidden text-center pt-2 -mb-1 text-cyan-400/50">
                      <ArrowDown size={14} className="mx-auto animate-bounce" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
