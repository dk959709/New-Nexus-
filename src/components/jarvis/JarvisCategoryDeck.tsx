import { useState } from 'react';
import {
  Atom,
  Server,
  ShieldAlert,
  TrendingUp,
  Dna,
  Zap,
  ArrowRight,
  Sparkles,
} from 'lucide-react';

interface JarvisCategoryDeckProps {
  onSelectPrompt: (prompt: string) => void;
}

interface CategoryCard {
  id: string;
  name: string;
  badge: string;
  emoji: string;
  icon: typeof Atom;
  accentColor: string;
  description: string;
  prompts: string[];
}

const CATEGORIES: CategoryCard[] = [
  {
    id: 'quantum-science',
    name: 'Quantum & Deep Physics',
    badge: 'ASTRO & QUANTUM',
    emoji: '🔬',
    icon: Atom,
    accentColor: '#61d7c9',
    description: 'Quantum computing architectures, nuclear fusion milestones, gravitational waves, and space physics.',
    prompts: [
      'Analyze recent breakthroughs in nuclear fusion net-energy experiments and commercial reactor timelines.',
      'Compare superconducting transmon qubits vs neutral atom trapped-ion quantum architectures.',
      'Summarize the latest observational findings from the James Webb Space Telescope regarding early galaxies.',
    ],
  },
  {
    id: 'systems-architecture',
    name: 'Systems & Architecture',
    badge: 'ENGINEERING',
    emoji: '💻',
    icon: Server,
    accentColor: '#38bdf8',
    description: 'Distributed consensus, zero-knowledge proofs, edge computing, and high-throughput concurrency.',
    prompts: [
      'Compare Raft vs Paxos consensus protocols in distributed fault-tolerant storage clusters.',
      'Synthesize trade-offs between Rust and Go for building low-latency financial order-routing gateways.',
      'Design a resilient multi-region event-driven architecture using Kafka, CQRS, and CDC.',
    ],
  },
  {
    id: 'fact-audit',
    name: 'Fact Verification & Audit',
    badge: 'TRUTH MATRIX',
    emoji: '🛡️',
    icon: ShieldAlert,
    accentColor: '#a855f7',
    description: 'Deconstruct popular misconceptions, audit numerical assertions, and cross-reference peer-reviewed claims.',
    prompts: [
      'Fact check claims that human attention span is now shorter than a goldfish (9 seconds vs 8 seconds).',
      'Audit the historical accuracy and origin of the myth that humans only utilize 10 percent of their brain.',
      'Verify the actual efficacy and scientific consensus regarding cold water immersion therapy (ice baths).',
    ],
  },
  {
    id: 'market-intel',
    name: 'Market Intelligence & Strategy',
    badge: 'ANALYSIS',
    emoji: '📊',
    icon: TrendingUp,
    accentColor: '#f1b66f',
    description: 'Semiconductor supply chains, AI accelerator silicon trends, global energy transitions, and tech economics.',
    prompts: [
      'Analyze the competitive landscape of AI accelerator ASICs: NVIDIA Blackwell vs Google TPU v6 vs AMD MI300X.',
      'Synthesize the global semiconductor supply chain dependencies on high-NA EUV lithography.',
      'Evaluate the economic feasibility and battery chemistry evolution of sodium-ion vs LFP cells.',
    ],
  },
  {
    id: 'biotech-genomics',
    name: 'BioTech & Synthetic Biology',
    badge: 'LIFE SCIENCES',
    emoji: '🧬',
    icon: Dna,
    accentColor: '#34d399',
    description: 'CRISPR base editing, mRNA vaccine platforms, longevity research, and synthetic biology breakthroughs.',
    prompts: [
      'Synthesize recent clinical trial developments in prime editing and in vivo CRISPR therapeutics.',
      'Explain the mechanism and current clinical evidence behind NAD+ precursors and cellular senescence clearance.',
      'Compare lipid nanoparticle (LNP) vs viral vector delivery systems for gene editing in hepatocytes.',
    ],
  },
  {
    id: 'reasoning-synthesis',
    name: 'Rapid Reasoning & Synthesis',
    badge: 'COGNITIVE MESH',
    emoji: '⚡',
    icon: Zap,
    accentColor: '#f43f5e',
    description: 'Multi-perspective executive summaries, scenario modeling, and structured philosophical syntheses.',
    prompts: [
      'Synthesize the philosophical and technical arguments surrounding the AI Alignment Problem and Orthogonality Thesis.',
      'Evaluate the ethical and geopolitical ramifications of orbital space debris and Kessler Syndrome mitigation.',
      'Synthesize the Fermi Paradox and evaluate the Great Filter hypothesis against Zoo and Rare Earth models.',
    ],
  },
];

export function JarvisCategoryDeck({ onSelectPrompt }: JarvisCategoryDeckProps) {
  const [activeCategory, setActiveCategory] = useState<string>('quantum-science');

  return (
    <div
      className="relative overflow-hidden rounded-3xl p-6 sm:p-7 backdrop-blur-xl transition-all duration-300"
      style={{
        background: 'linear-gradient(145deg, rgba(8, 20, 36, 0.88) 0%, rgba(14, 18, 48, 0.92) 50%, rgba(6, 26, 38, 0.88) 100%)',
        border: '1.5px solid rgba(97, 215, 201, 0.35)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.5), 0 0 32px rgba(97,215,201,0.12)',
      }}
    >
      {/* Title & Info */}
      <div className="flex items-center justify-between flex-wrap gap-2 mb-5 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-cyan-500/30 to-purple-500/30 border border-cyan-400/50 flex items-center justify-center shadow-[0_0_16px_rgba(97,215,201,0.3)]">
            <Sparkles size={18} className="text-cyan-300 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold text-white m-0 tracking-tight">
                JARVIS Intelligence Category Matrix
              </h3>
              <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-[10px] font-mono font-bold">
                6 DOMAINS
              </span>
            </div>
            <p className="text-xs text-slate-400 m-0 mt-0.5">
              Curated inquiry tracks tuned specifically for the 5-Agent research, verification, and synthesis pipeline.
            </p>
          </div>
        </div>
      </div>

      {/* Category Selection Cards Grid (Rounded & Colorful) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        {CATEGORIES.map((cat) => {
          const isSelected = activeCategory === cat.id;
          const IconComp = cat.icon;

          return (
            <div
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className="p-4 rounded-2xl cursor-pointer transition-all duration-300 relative overflow-hidden"
              style={{
                border: isSelected
                  ? `1.5px solid ${cat.accentColor}`
                  : '1px solid rgba(255, 255, 255, 0.08)',
                background: isSelected
                  ? `linear-gradient(135deg, ${cat.accentColor}25 0%, rgba(10,24,36,0.95) 100%)`
                  : 'rgba(6, 16, 26, 0.65)',
                boxShadow: isSelected
                  ? `0 10px 30px rgba(0,0,0,0.5), 0 0 20px ${cat.accentColor}35`
                  : 'none',
                transform: isSelected ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full border"
                  style={{
                    color: cat.accentColor,
                    background: `${cat.accentColor}18`,
                    borderColor: `${cat.accentColor}40`,
                  }}
                >
                  {cat.badge}
                </span>
                <span className="text-lg">{cat.emoji}</span>
              </div>

              <div className="flex items-center gap-2.5 mb-1.5">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                  style={{
                    background: `${cat.accentColor}25`,
                    border: `1px solid ${cat.accentColor}50`,
                  }}
                >
                  <IconComp size={15} style={{ color: cat.accentColor }} />
                </div>
                <h4 className="text-sm font-bold text-white m-0 truncate">
                  {cat.name}
                </h4>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed m-0 line-clamp-2">
                {cat.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Active Category Prompts Deck (Rounded & Colorful) */}
      {(() => {
        const cat = CATEGORIES.find((c) => c.id === activeCategory) || CATEGORIES[0];
        return (
          <div
            className="p-5 rounded-2xl backdrop-blur-md transition-all duration-300"
            style={{
              background: 'rgba(5, 14, 25, 0.85)',
              border: `1.5px solid ${cat.accentColor}45`,
              boxShadow: `0 8px 24px rgba(0,0,0,0.4), 0 0 16px ${cat.accentColor}15`,
            }}
          >
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{cat.emoji}</span>
                <span className="text-sm font-bold text-white">
                  Curated Prompts for {cat.name}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                Click prompt to auto-load in 5-Agent pipeline
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {cat.prompts.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => onSelectPrompt(prompt)}
                  className="w-full text-left p-3.5 rounded-xl transition-all duration-200 flex items-center justify-between gap-3 text-xs sm:text-sm font-medium leading-relaxed group"
                  style={{
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#e2e8f0',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${cat.accentColor}18`;
                    e.currentTarget.style.borderColor = `${cat.accentColor}60`;
                    e.currentTarget.style.color = '#ffffff';
                    e.currentTarget.style.boxShadow = `0 0 16px ${cat.accentColor}25`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.color = '#e2e8f0';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <span className="flex-1">{prompt}</span>
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-transform group-hover:translate-x-1"
                    style={{
                      background: `${cat.accentColor}25`,
                      border: `1px solid ${cat.accentColor}50`,
                    }}
                  >
                    <ArrowRight size={13} style={{ color: cat.accentColor }} />
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
