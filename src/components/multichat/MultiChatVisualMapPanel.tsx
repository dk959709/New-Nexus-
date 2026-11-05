import React, { useState, useRef } from 'react';
import {
  Network,
  Sparkles,
  Send,
  PenLine,
  RotateCcw,
  Download,
  Copy,
  Check,
  X,
  GitBranch,
  Loader2,
} from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import type {
  MultiChatMessage,
  MultiChatVisualMapNode,
  MultiChatPersonaId,
} from '@/types';

interface MultiChatVisualMapPanelProps {
  message: MultiChatMessage;
  isLoading: boolean;
  isGeneratingTurn: boolean;
  onRegenerate: (msg: MultiChatMessage) => void;
  onSendFollowUp: (prompt: string) => void;
  onPrefillInput: (prompt: string) => void;
  onClose: () => void;
}

export const MultiChatVisualMapPanel: React.FC<MultiChatVisualMapPanelProps> = ({
  message,
  isLoading,
  isGeneratingTurn,
  onRegenerate,
  onSendFollowUp,
  onPrefillInput,
  onClose,
}) => {
  const mapData = message.visualMap;
  const [layoutMode, setLayoutMode] = useState<'canvas' | 'tree'>('canvas');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [copiedMermaid, setCopiedMermaid] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const nodes = mapData?.nodes || [];
  const activeNode: MultiChatVisualMapNode | null =
    nodes.find((n) => n.id === selectedNodeId) || nodes[0] || null;

  const novaNodes = nodes.filter((n) => n.personaId === 'nova');
  const orbitNodes = nodes.filter((n) => n.personaId === 'orbit');
  const cosmosNodes = nodes.filter((n) => n.personaId === 'cosmos');

  const handleCopyMermaid = async () => {
    if (!mapData) return;
    const safe = (str: string) => str.replace(/["[\]()]/g, '').trim();
    const lines: string[] = [
      'flowchart TD',
      `  ROOT["🎯 ${safe(mapData.centerTitle)}"]`,
      '  NOVA["🔬 NOVA · Analytical & Technical"]',
      '  ORBIT["💡 ORBIT · Action & Execution"]',
      '  COSMOS["🌌 COSMOS · Strategic & Holistic"]',
      '  ROOT --> NOVA',
      '  ROOT --> ORBIT',
      '  ROOT --> COSMOS',
    ];
    nodes.forEach((n, idx) => {
      const hub = n.personaId.toUpperCase();
      lines.push(`  N${idx}["${safe(n.title)}: ${safe(n.summary.slice(0, 70))}"]`);
      lines.push(`  ${hub} --> N${idx}`);
    });
    const ok = await copyToClipboard(lines.join('\n'));
    if (ok) {
      setCopiedMermaid(true);
      setTimeout(() => setCopiedMermaid(false), 2000);
    }
  };

  const handleDownloadSvg = () => {
    if (!svgRef.current || !mapData) return;
    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgRef.current);
    if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
      source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = mapData.centerTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .slice(0, 24);
    a.download = `nexus_visual_map_${slug || 'tri_mind'}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  // Coordinates for the SVG Mind-Map (920 x 450 viewBox)
  const centerPos = { x: 460, y: 215 };
  const hubPositions: Record<
    MultiChatPersonaId,
    { x: number; y: number; name: string; icon: string; color: string; sub: string }
  > = {
    nova: {
      x: 225,
      y: 115,
      name: 'NOVA',
      icon: '🔬',
      color: '#38bdf8',
      sub: 'Analytical',
    },
    orbit: {
      x: 695,
      y: 115,
      name: 'ORBIT',
      icon: '💡',
      color: '#f59e0b',
      sub: 'Actionable',
    },
    cosmos: {
      x: 460,
      y: 345,
      name: 'COSMOS',
      icon: '🌌',
      color: '#c084fc',
      sub: 'Strategic',
    },
  };

  const getLeafPosition = (personaId: MultiChatPersonaId, indexInPersona: number) => {
    if (personaId === 'nova') {
      return indexInPersona === 0 ? { x: 105, y: 48 } : { x: 105, y: 215 };
    }
    if (personaId === 'orbit') {
      return indexInPersona === 0 ? { x: 815, y: 48 } : { x: 815, y: 215 };
    }
    return indexInPersona === 0 ? { x: 220, y: 392 } : { x: 700, y: 392 };
  };

  return (
    <div className="p-3 sm:p-4 bg-gradient-to-b from-cyan-950/25 via-slate-950/95 to-slate-950 border-t border-cyan-500/30 flex flex-col gap-3">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-500/20 border border-cyan-400/40 text-cyan-200 text-[10px] sm:text-xs font-mono font-bold flex items-center gap-1.5">
            <Network size={12} className="text-cyan-400" />
            TRI-MIND VISUAL MIND-MAP & FLOWCHART
          </span>
          <span className="text-[11px] text-slate-400 hidden md:inline">
            Click any node to inspect or launch a targeted follow-up query
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap ml-auto">
          {/* View Switcher: Interactive SVG Canvas vs Structured Flowchart */}
          <div className="flex items-center p-0.5 rounded-xl bg-black/50 border border-white/10 text-[10.5px] font-mono">
            <button
              type="button"
              onClick={() => setLayoutMode('canvas')}
              className={`px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all ${
                layoutMode === 'canvas'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Network size={11} />
              <span>Mind-Map</span>
            </button>
            <button
              type="button"
              onClick={() => setLayoutMode('tree')}
              className={`px-2 py-0.5 rounded-lg flex items-center gap-1 transition-all ${
                layoutMode === 'tree'
                  ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/40 font-bold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <GitBranch size={11} />
              <span>Flowchart</span>
            </button>
          </div>

          {mapData && (
            <>
              <button
                type="button"
                onClick={() => onRegenerate(message)}
                disabled={isLoading || isGeneratingTurn}
                className="px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-cyan-300 flex items-center gap-1 disabled:opacity-50"
                title="Regenerate Visual Mind-Map with AI"
              >
                <RotateCcw size={11} className={isLoading ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">Refresh</span>
              </button>

              <button
                type="button"
                onClick={handleCopyMermaid}
                className="px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-slate-200 flex items-center gap-1"
                title="Copy Mermaid.js Flowchart syntax"
              >
                {copiedMermaid ? (
                  <>
                    <Check size={11} className="text-emerald-400" />
                    <span className="text-emerald-300">Mermaid Copied</span>
                  </>
                ) : (
                  <>
                    <Copy size={11} />
                    <span className="hidden sm:inline">Mermaid</span>
                  </>
                )}
              </button>

              {layoutMode === 'canvas' && (
                <button
                  type="button"
                  onClick={handleDownloadSvg}
                  className="px-2 py-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[11px] font-mono text-emerald-300 flex items-center gap-1"
                  title="Download Mind-Map as SVG vector image"
                >
                  <Download size={11} />
                  <span className="hidden sm:inline">SVG</span>
                </button>
              )}
            </>
          )}

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white"
            title="Close Visual Map"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && !mapData ? (
        <div className="py-10 flex flex-col items-center justify-center gap-2.5 text-cyan-300 font-mono text-xs">
          <Loader2 size={22} className="animate-spin text-cyan-400" />
          <span>Synthesizing interactive Tri-Mind Visual Map & Flowchart nodes...</span>
        </div>
      ) : mapData ? (
        <>
          {/* MODE 1: INTERACTIVE SVG RADIAL MIND-MAP CANVAS */}
          {layoutMode === 'canvas' && (
            <div className="relative w-full rounded-2xl bg-[#070a12] border border-cyan-500/25 overflow-hidden shadow-inner">
              <svg
                ref={svgRef}
                viewBox="0 0 920 445"
                className="w-full h-auto max-h-[420px] select-none block"
              >
                <defs>
                  <radialGradient id="vmCenterGlow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.35" />
                    <stop offset="65%" stopColor="#6366f1" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#090d16" stopOpacity="0" />
                  </radialGradient>
                  <pattern
                    id="vmGrid"
                    width="28"
                    height="28"
                    patternUnits="userSpaceOnUse"
                  >
                    <path
                      d="M 28 0 L 0 0 0 28"
                      fill="none"
                      stroke="rgba(148,163,184,0.06)"
                      strokeWidth="1"
                    />
                  </pattern>
                </defs>

                {/* Subtle Cybernetic Grid Background */}
                <rect width="920" height="445" fill="#070a12" />
                <rect width="920" height="445" fill="url(#vmGrid)" />
                <circle
                  cx={centerPos.x}
                  cy={centerPos.y}
                  r="175"
                  fill="url(#vmCenterGlow)"
                />

                {/* Orbital Reference Ring */}
                <circle
                  cx={centerPos.x}
                  cy={centerPos.y}
                  r="135"
                  fill="none"
                  stroke="rgba(56,189,248,0.14)"
                  strokeWidth="1"
                  strokeDasharray="5 5"
                />

                {/* Bezier Connections: Center -> 3 Persona Hubs */}
                {(['nova', 'orbit', 'cosmos'] as MultiChatPersonaId[]).map((pid) => {
                  const hub = hubPositions[pid];
                  const pathD = `M ${centerPos.x} ${centerPos.y} Q ${(centerPos.x + hub.x) / 2} ${centerPos.y} ${hub.x} ${hub.y}`;
                  return (
                    <g key={`edge_hub_${pid}`}>
                      <path
                        d={pathD}
                        fill="none"
                        stroke={hub.color}
                        strokeWidth="2.2"
                        strokeOpacity="0.55"
                      />
                      <path
                        d={pathD}
                        fill="none"
                        stroke={hub.color}
                        strokeWidth="1.2"
                        strokeDasharray="6 6"
                      />
                    </g>
                  );
                })}

                {/* Bezier Connections & Leaf Nodes for Each Persona */}
                {(['nova', 'orbit', 'cosmos'] as MultiChatPersonaId[]).map((pid) => {
                  const hub = hubPositions[pid];
                  const pNodes =
                    pid === 'nova'
                      ? novaNodes
                      : pid === 'orbit'
                      ? orbitNodes
                      : cosmosNodes;

                  return pNodes.slice(0, 2).map((node, idx) => {
                    const leaf = getLeafPosition(pid, idx);
                    const isSelected = activeNode?.id === node.id;
                    const curveD = `M ${hub.x} ${hub.y} C ${(hub.x + leaf.x) / 2} ${hub.y}, ${(hub.x + leaf.x) / 2} ${leaf.y}, ${leaf.x} ${leaf.y}`;
                    const boxW = 192;
                    const boxH = 58;

                    return (
                      <g key={`leaf_${pid}_${node.id || idx}_${idx}`}>
                        <path
                          d={curveD}
                          fill="none"
                          stroke={node.accentColor}
                          strokeWidth={isSelected ? '2.6' : '1.6'}
                          strokeOpacity={isSelected ? '0.95' : '0.45'}
                        />
                        <g
                          transform={`translate(${leaf.x - boxW / 2}, ${leaf.y - boxH / 2})`}
                          onClick={() => setSelectedNodeId(node.id)}
                          className="cursor-pointer"
                        >
                          <rect
                            width={boxW}
                            height={boxH}
                            rx="12"
                            fill={isSelected ? '#111c2d' : '#0b101b'}
                            stroke={node.accentColor}
                            strokeWidth={isSelected ? '2.2' : '1.2'}
                            strokeOpacity={isSelected ? '1' : '0.55'}
                          />
                          <circle
                            cx="16"
                            cy="18"
                            r="5"
                            fill={node.accentColor}
                          />
                          <text
                            x="27"
                            y="21"
                            fill="#f8fafc"
                            fontSize="11"
                            fontWeight="700"
                            fontFamily="ui-sans-serif, system-ui, sans-serif"
                          >
                            {node.title.length > 22
                              ? `${node.title.slice(0, 22)}…`
                              : node.title}
                          </text>
                          <text
                            x="14"
                            y="39"
                            fill="#94a3b8"
                            fontSize="9.5"
                            fontFamily="ui-monospace, monospace"
                          >
                            {node.summary.length > 29
                              ? `${node.summary.slice(0, 29)}…`
                              : node.summary}
                          </text>
                          <text
                            x={boxW - 12}
                            y="50"
                            textAnchor="end"
                            fill={node.accentColor}
                            fontSize="8.5"
                            fontWeight="700"
                            fontFamily="ui-monospace, monospace"
                          >
                            {isSelected ? '● ACTIVE' : 'CLICK ➔'}
                          </text>
                        </g>
                      </g>
                    );
                  });
                })}

                {/* 3 Persona Hub Nodes */}
                {(['nova', 'orbit', 'cosmos'] as MultiChatPersonaId[]).map((pid) => {
                  const hub = hubPositions[pid];
                  return (
                    <g
                      key={`hub_${pid}`}
                      transform={`translate(${hub.x}, ${hub.y})`}
                    >
                      <circle
                        r="32"
                        fill="#0b1322"
                        stroke={hub.color}
                        strokeWidth="2"
                      />
                      <circle
                        r="37"
                        fill="none"
                        stroke={hub.color}
                        strokeWidth="1"
                        strokeOpacity="0.35"
                        strokeDasharray="3 3"
                      />
                      <text
                        y="-4"
                        textAnchor="middle"
                        fontSize="15"
                      >
                        {hub.icon}
                      </text>
                      <text
                        y="11"
                        textAnchor="middle"
                        fill={hub.color}
                        fontSize="10"
                        fontWeight="800"
                        fontFamily="ui-monospace, monospace"
                      >
                        {hub.name}
                      </text>
                      <text
                        y="22"
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="8"
                        fontFamily="ui-monospace, monospace"
                      >
                        {hub.sub}
                      </text>
                    </g>
                  );
                })}

                {/* Central Query Core Node */}
                <g transform={`translate(${centerPos.x}, ${centerPos.y})`}>
                  <rect
                    x="-115"
                    y="-34"
                    width="230"
                    height="68"
                    rx="18"
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth="2.2"
                  />
                  <text
                    y="-11"
                    textAnchor="middle"
                    fill="#67e8f9"
                    fontSize="9.5"
                    fontWeight="700"
                    fontFamily="ui-monospace, monospace"
                  >
                    🎯 CORE INQUIRY NEXUS
                  </text>
                  <text
                    y="7"
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="12"
                    fontWeight="800"
                    fontFamily="ui-sans-serif, system-ui, sans-serif"
                  >
                    {mapData.centerTitle.length > 26
                      ? `${mapData.centerTitle.slice(0, 26)}…`
                      : mapData.centerTitle}
                  </text>
                  <text
                    y="23"
                    textAnchor="middle"
                    fill="#94a3b8"
                    fontSize="9.5"
                    fontFamily="ui-monospace, monospace"
                  >
                    {mapData.centerSubtitle.length > 32
                      ? `${mapData.centerSubtitle.slice(0, 32)}…`
                      : mapData.centerSubtitle}
                  </text>
                </g>
              </svg>
            </div>
          )}

          {/* MODE 2: 3-COLUMN DECISION FLOWCHART TREE VIEW */}
          {layoutMode === 'tree' && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              {(['nova', 'orbit', 'cosmos'] as MultiChatPersonaId[]).map((pid) => {
                const hub = hubPositions[pid];
                const branchNodes = nodes.filter((n) => n.personaId === pid);
                return (
                  <div
                    key={pid}
                    className="p-3 rounded-2xl bg-black/50 border flex flex-col gap-2.5"
                    style={{ borderColor: `${hub.color}40` }}
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-white/10">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base">{hub.icon}</span>
                        <span
                          className="font-bold text-xs font-mono"
                          style={{ color: hub.color }}
                        >
                          {hub.name} BRANCH
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-400">
                        {hub.sub}
                      </span>
                    </div>

                    {branchNodes.map((node, nIdx) => {
                      const isSel = activeNode?.id === node.id;
                      return (
                        <div
                          key={`tree_${pid}_${node.id || nIdx}_${nIdx}`}
                          onClick={() => setSelectedNodeId(node.id)}
                          className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col gap-1.5 ${
                            isSel
                              ? 'bg-white/[0.07] shadow-md'
                              : 'bg-black/40 hover:bg-white/[0.04]'
                          }`}
                          style={{
                            borderColor: isSel ? node.accentColor : 'rgba(255,255,255,0.1)',
                          }}
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-white">
                              {node.title}
                            </span>
                            <span
                              className="text-[9.5px] font-mono px-1.5 py-0.2 rounded-full"
                              style={{
                                background: `${node.accentColor}20`,
                                color: node.accentColor,
                              }}
                            >
                              @{node.personaId}
                            </span>
                          </div>
                          <p className="text-[11.5px] text-slate-300 leading-relaxed m-0">
                            {node.summary}
                          </p>
                          <div className="flex items-center gap-1.5 pt-1">
                            <button
                              type="button"
                              disabled={isGeneratingTurn}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSendFollowUp(node.followUpPrompt);
                              }}
                              className="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200 border border-cyan-500/35 flex items-center gap-1"
                            >
                              <Send size={9} />
                              <span>Explore Node</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onPrefillInput(node.followUpPrompt);
                              }}
                              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300"
                              title="Edit follow-up in input box"
                            >
                              <PenLine size={10} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}

          {/* Selected Node Interactive Inspector + 1-Click Deep-Dive Bar */}
          {activeNode && (
            <div
              className="p-3 rounded-2xl bg-black/60 border flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              style={{ borderColor: `${activeNode.accentColor}50` }}
            >
              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                <div
                  className="w-8 h-8 rounded-xl grid place-items-center text-base shrink-0 mt-0.5"
                  style={{
                    background: `${activeNode.accentColor}20`,
                    border: `1px solid ${activeNode.accentColor}50`,
                  }}
                >
                  {activeNode.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                    <span
                      className="text-xs font-extrabold font-mono"
                      style={{ color: activeNode.accentColor }}
                    >
                      {activeNode.personaName} NODE:
                    </span>
                    <span className="text-xs font-bold text-white">
                      {activeNode.title}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      ({activeNode.branchLabel})
                    </span>
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed m-0">
                    {activeNode.summary}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={isGeneratingTurn}
                  onClick={() => onSendFollowUp(activeNode.followUpPrompt)}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-slate-950 shadow-md transition-all cursor-pointer disabled:opacity-50"
                  title={`Broadcast follow-up: "${activeNode.followUpPrompt}"`}
                >
                  <Sparkles size={12} />
                  <span>Explore This Node</span>
                </button>
                <button
                  type="button"
                  onClick={() => onPrefillInput(activeNode.followUpPrompt)}
                  className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-200 flex items-center gap-1"
                  title="Edit prompt in input box"
                >
                  <PenLine size={12} />
                  <span className="hidden sm:inline">Edit</span>
                </button>
              </div>
            </div>
          )}

          {/* Overarching Synthesis Footer */}
          {mapData.synthesisTakeaway && (
            <div className="px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.07] text-[11.5px] text-slate-300 flex items-center gap-2">
              <span className="text-cyan-400 font-mono font-bold shrink-0">
                ⚡ NEXUS TAKEAWAY:
              </span>
              <span className="leading-snug">{mapData.synthesisTakeaway}</span>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};
