import { AlertCircle, Sparkles, Wand2 } from 'lucide-react';

type SynthesisReactorProps = {
  phase: 'enhancing' | 'generating';
  aspectRatio: string;
  maxHeight?: number;
  providerName?: string;
  failoverNotice?: string | null;
  className?: string;
};

const PHASES = [
  { id: '01', label: 'Prompt refine' },
  { id: '02', label: 'Synthesis' },
  { id: '03', label: 'Present' },
];

export function SynthesisReactor({
  phase,
  aspectRatio,
  maxHeight = 480,
  providerName,
  failoverNotice,
  className,
}: SynthesisReactorProps) {
  const activeIndex = phase === 'enhancing' ? 0 : 1;

  return (
    <div
      className={`is-reactor-stage relative w-full min-h-[340px] flex flex-col items-center justify-center gap-5 p-6 text-center bg-[#0c0c12] overflow-hidden ${
        className ?? ''
      }`}
      style={{ aspectRatio, maxHeight }}
    >
      <span aria-hidden="true" className="is-reactor-grid absolute inset-0 pointer-events-none" />
      <span aria-hidden="true" className="is-reactor-scan absolute inset-x-0 h-24 pointer-events-none" />

      <span className="absolute top-2.5 left-2.5 w-3 h-3 border-t border-l border-pink-500/40" />
      <span className="absolute top-2.5 right-2.5 w-3 h-3 border-t border-r border-pink-500/25" />
      <span className="absolute bottom-2.5 left-2.5 w-3 h-3 border-b border-l border-pink-500/25" />
      <span className="absolute bottom-2.5 right-2.5 w-3 h-3 border-b border-r border-pink-500/40" />

      <div className="relative w-[136px] h-[136px] shrink-0">
        <span
          aria-hidden="true"
          className="is-reactor-halo absolute inset-[34px] rounded-full border border-pink-500/25"
        />
        <span
          aria-hidden="true"
          className="is-reactor-ring absolute inset-0 rounded-full border border-[#252532]"
        />
        <span
          aria-hidden="true"
          className="is-reactor-ring is-reactor-ring-dashed absolute inset-[9px] rounded-full border border-dashed border-pink-500/40"
        />
        <span
          aria-hidden="true"
          className="is-reactor-ring is-reactor-ring-reverse absolute inset-[25px] rounded-full border border-violet-500/30"
        />

        <span aria-hidden="true" className="is-reactor-orbit absolute inset-[24px]">
          {[0, 90, 180, 270].map((angle) => (
            <span
              key={angle}
              className="is-reactor-node absolute left-1/2 top-1/2 w-1.5 h-1.5 -ml-[3px] -mt-[3px] rounded-full bg-pink-400"
              style={{ transform: `rotate(${angle}deg) translateY(-44px)` }}
            />
          ))}
        </span>

        <span className="is-reactor-core absolute inset-[46px] rounded-full bg-gradient-to-br from-pink-500/25 to-violet-600/25 border border-pink-500/50 flex items-center justify-center text-pink-200">
          {phase === 'enhancing' ? <Wand2 size={20} /> : <Sparkles size={20} />}
        </span>
      </div>

      <div className="relative max-w-sm">
        <h4 className="m-0 text-sm font-mono font-bold text-white uppercase tracking-wide">
          {phase === 'enhancing' ? 'Refining prompt with Smart AI…' : 'Synthesizing visual output…'}
        </h4>
        <p
          className={`mt-1.5 mb-0 text-xs font-mono leading-relaxed ${
            failoverNotice ? 'text-amber-300 font-semibold' : 'text-gray-400'
          }`}
        >
          {failoverNotice ? (
            <span className="inline-flex items-center gap-1.5">
              <AlertCircle size={12} className="shrink-0" />
              {failoverNotice}
            </span>
          ) : phase === 'enhancing' ? (
            'Rewriting scene description with lighting & detail…'
          ) : (
            `Active engine: ${providerName || 'Image provider'}`
          )}
        </p>
      </div>

      <div className="relative grid w-full max-w-md grid-cols-3 gap-2 sm:gap-3">
        {PHASES.map((step, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          return (
            <div key={step.id} className="min-w-0 text-left">
              <div
                className={`flex items-center gap-1.5 ${
                  done ? 'text-emerald-300' : active ? 'text-pink-300' : 'text-zinc-600'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    done
                      ? 'bg-emerald-400'
                      : active
                        ? 'is-phase-dot bg-pink-400'
                        : 'bg-zinc-700'
                  }`}
                />
                <span className="truncate font-mono text-[9px] uppercase tracking-[0.12em]">
                  {step.id} {step.label}
                </span>
              </div>
              <div className="mt-1 h-[2px] overflow-hidden rounded-full bg-[#1e1e29]">
                <span
                  className={`block h-full rounded-full ${
                    done
                      ? 'w-full bg-emerald-400/70'
                      : active
                        ? 'is-phase-bar w-full bg-gradient-to-r from-pink-500 to-violet-500'
                        : 'w-0'
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
