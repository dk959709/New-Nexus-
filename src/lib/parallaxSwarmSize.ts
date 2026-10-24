import type { ParallaxAgent } from '../types';

export type ParallaxSwarmSize = 5 | 10 | 15 | 20;

export const PARALLAX_SWARM_SIZES: ParallaxSwarmSize[] = [5, 10, 15, 20];

export const PARALLAX_AGENT_PRIORITY: string[] = [
  'veritas',
  'axiom',
  'socrates',
  'harmony',
  'nexus9',
  'aurora',
  'chronos',
  'ledger',
  'vanguard',
  'sentinel',
  'cipher',
  'echo',
  'catalyst',
  'gravity',
  'nomad',
  'lumen',
  'pixel',
  'mosaic',
  'oracle',
  'ember',
];

export const CORE_PARALLAX_AGENT_IDS: string[] = [
  'veritas',
  'axiom',
  'socrates',
  'harmony',
  'nexus9',
];

export function isValidSwarmSize(v: unknown): v is ParallaxSwarmSize {
  return v === 5 || v === 10 || v === 15 || v === 20;
}

export function getSpecialistCap(size: ParallaxSwarmSize): number {
  switch (size) {
    case 5:
      return 1;
    case 10:
      return 2;
    case 15:
      return 3;
    case 20:
    default:
      return 5;
  }
}

export function selectSwarmAgents<T extends Pick<ParallaxAgent, 'id'>>(
  enabledAgents: T[],
  size: ParallaxSwarmSize
): T[] {
  if (!Array.isArray(enabledAgents) || enabledAgents.length === 0) {
    return [];
  }

  const priorityMap = new Map<string, number>();
  PARALLAX_AGENT_PRIORITY.forEach((id, index) => {
    priorityMap.set(id, index);
  });

  const indexed = enabledAgents.map((agent, originalIndex) => ({
    agent,
    originalIndex,
    priority: priorityMap.has(agent.id)
      ? (priorityMap.get(agent.id) as number)
      : PARALLAX_AGENT_PRIORITY.length + originalIndex,
  }));

  indexed.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return a.originalIndex - b.originalIndex;
  });

  const sorted = indexed.map((item) => item.agent);
  if (sorted.length <= size) {
    return sorted;
  }
  return sorted.slice(0, size);
}
