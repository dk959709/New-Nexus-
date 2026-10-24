import type { ParallaxAgentConfig, ParallaxDebateMode } from '@/types';
import { getDebateModeConfig } from '@/data/parallaxDebateModes';

export interface ModeSideAssignment {
  side: string;
  sideLabel: string;
  color: string;
}

const MODE_PREFERENCES: Record<string, Record<string, string[]>> = {
  courtroom: {
    prosecution: ['vanguard', 'sentinel', 'veritas', 'socrates', 'chronos', 'ledger', 'cipher', 'gravity'],
    defense: ['aurora', 'catalyst', 'harmony', 'echo', 'lumen', 'oracle', 'pixel', 'ember', 'mosaic', 'nomad', 'axiom'],
    judge: ['nexus9'],
  },
  red_vs_blue: {
    red: ['vanguard', 'sentinel', 'veritas', 'socrates', 'cipher', 'chronos', 'ember'],
    blue: ['aurora', 'catalyst', 'gravity', 'ledger', 'harmony', 'lumen', 'nomad', 'axiom', 'echo', 'oracle', 'pixel', 'mosaic'],
    referee: ['nexus9'],
  },
  senate: {
    security: ['sentinel', 'vanguard', 'gravity', 'chronos', 'veritas'],
    innovation: ['catalyst', 'aurora', 'oracle', 'pixel', 'cipher'],
    economy: ['ledger', 'axiom', 'echo', 'nomad'],
    ethics: ['harmony', 'socrates', 'lumen', 'ember', 'mosaic'],
  },
  vc_pitch: {
    market: ['echo', 'nomad', 'aurora', 'catalyst', 'pixel', 'lumen'],
    tech: ['cipher', 'axiom', 'oracle', 'mosaic'],
    finance: ['ledger', 'gravity', 'chronos'],
    risk: ['sentinel', 'vanguard', 'veritas', 'socrates', 'harmony', 'ember'],
  },
};

const TEAM_MODES = new Set<string>(['courtroom', 'red_vs_blue', 'senate', 'vc_pitch']);

export function isTeamDebateMode(mode?: ParallaxDebateMode | string): boolean {
  return Boolean(mode && TEAM_MODES.has(mode));
}

export function assignModeSides(
  mode: ParallaxDebateMode | string | undefined,
  agents: Array<Pick<ParallaxAgentConfig, 'id'> & { isDynamic?: boolean }>,
): Map<string, ModeSideAssignment> {
  const result = new Map<string, ModeSideAssignment>();

  if (!mode || !TEAM_MODES.has(mode) || !Array.isArray(agents) || agents.length < 3) {
    return result;
  }

  const modeConfig = getDebateModeConfig(mode);
  const allSides = modeConfig.sides || [];
  if (allSides.length === 0) {
    return result;
  }

  const sideMeta = new Map<string, { label: string; color: string }>();
  allSides.forEach((s) => {
    sideMeta.set(s.id, { label: s.label, color: s.color });
  });

  const specialSideId =
    mode === 'courtroom' ? 'judge' : mode === 'red_vs_blue' ? 'referee' : null;
  const regularSideIds = allSides
    .map((s) => s.id)
    .filter((id) => id !== specialSideId);

  if (regularSideIds.length === 0) {
    return result;
  }

  // Determine judge / referee for courtroom and red_vs_blue
  let designatedSpecialAgentId: string | null = null;
  if (specialSideId) {
    const hasNexus9 = agents.find((a) => a.id.toLowerCase() === 'nexus9');
    if (hasNexus9) {
      designatedSpecialAgentId = hasNexus9.id;
    } else {
      const hasAxiom = agents.find((a) => a.id.toLowerCase() === 'axiom');
      designatedSpecialAgentId = hasAxiom ? hasAxiom.id : agents[0].id;
    }
  }

  const sideCounts = new Map<string, number>();
  regularSideIds.forEach((sId) => sideCounts.set(sId, 0));

  const getSmallestRegularSide = (): string => {
    let bestSide = regularSideIds[0];
    let minCount = sideCounts.get(bestSide) ?? 0;
    for (const sId of regularSideIds) {
      const c = sideCounts.get(sId) ?? 0;
      if (c < minCount) {
        minCount = c;
        bestSide = sId;
      }
    }
    return bestSide;
  };

  const getMinRegularCount = (): number => {
    let minCount = Infinity;
    for (const sId of regularSideIds) {
      const c = sideCounts.get(sId) ?? 0;
      if (c < minCount) minCount = c;
    }
    return minCount === Infinity ? 0 : minCount;
  };

  const prefsForMode = MODE_PREFERENCES[mode] || {};

  const findPreferredSide = (agentIdLower: string): string | null => {
    for (const sId of regularSideIds) {
      const list = prefsForMode[sId];
      if (list && list.includes(agentIdLower)) {
        return sId;
      }
    }
    return null;
  };

  // Assign each agent in order
  for (const agent of agents) {
    if (specialSideId && designatedSpecialAgentId && agent.id === designatedSpecialAgentId) {
      const meta = sideMeta.get(specialSideId) || {
        label: specialSideId === 'judge' ? 'Judge' : 'Referee',
        color: '#f59e0b',
      };
      result.set(agent.id, {
        side: specialSideId,
        sideLabel: meta.label,
        color: meta.color,
      });
      continue;
    }

    const idLower = agent.id.toLowerCase();
    const preferred = agent.isDynamic ? null : findPreferredSide(idLower);

    let chosenSide: string;
    if (!preferred) {
      chosenSide = getSmallestRegularSide();
    } else {
      const prefCount = sideCounts.get(preferred) ?? 0;
      const minCount = getMinRegularCount();
      if (prefCount - minCount > 1) {
        chosenSide = getSmallestRegularSide();
      } else {
        chosenSide = preferred;
      }
    }

    sideCounts.set(chosenSide, (sideCounts.get(chosenSide) ?? 0) + 1);
    const meta = sideMeta.get(chosenSide) || { label: chosenSide, color: '#61d7c9' };
    result.set(agent.id, {
      side: chosenSide,
      sideLabel: meta.label,
      color: meta.color,
    });
  }

  // Ensure every regular side has at least 1 agent when total regular agents >= regularSideIds.length
  const regularAgentsCount = agents.length - (designatedSpecialAgentId ? 1 : 0);
  if (regularAgentsCount >= regularSideIds.length) {
    for (const emptySideId of regularSideIds) {
      if ((sideCounts.get(emptySideId) ?? 0) === 0) {
        // Find a side with the most members (> 1) and move its last assigned agent to emptySideId
        let largestSide = regularSideIds[0];
        let maxCount = 0;
        for (const sId of regularSideIds) {
          const c = sideCounts.get(sId) ?? 0;
          if (c > maxCount) {
            maxCount = c;
            largestSide = sId;
          }
        }
        if (maxCount > 1) {
          const candidates = Array.from(result.entries()).filter(
            ([, val]) => val.side === largestSide,
          );
          const toMove = candidates[candidates.length - 1];
          if (toMove) {
            const meta = sideMeta.get(emptySideId) || { label: emptySideId, color: '#61d7c9' };
            result.set(toMove[0], {
              side: emptySideId,
              sideLabel: meta.label,
              color: meta.color,
            });
            sideCounts.set(largestSide, maxCount - 1);
            sideCounts.set(emptySideId, 1);
          }
        }
      }
    }
  }

  return result;
}

export function getOpposingAgentIds(
  mode: ParallaxDebateMode | string | undefined,
  agentId: string,
  assignments: Map<string, ModeSideAssignment>,
): string[] {
  if (!mode || !TEAM_MODES.has(mode) || assignments.size === 0) {
    return [];
  }

  const myAssignment = assignments.get(agentId);
  if (!myAssignment) {
    return [];
  }

  const mySide = myAssignment.side;
  const opponents: string[] = [];

  for (const [otherId, otherAssign] of assignments.entries()) {
    if (otherId === agentId) continue;

    if (mySide === 'judge' || mySide === 'referee') {
      opponents.push(otherId);
      continue;
    }

    if (mode === 'courtroom') {
      if (mySide === 'prosecution' && otherAssign.side === 'defense') {
        opponents.push(otherId);
      } else if (mySide === 'defense' && otherAssign.side === 'prosecution') {
        opponents.push(otherId);
      }
    } else if (mode === 'red_vs_blue') {
      if (mySide === 'red' && otherAssign.side === 'blue') {
        opponents.push(otherId);
      } else if (mySide === 'blue' && otherAssign.side === 'red') {
        opponents.push(otherId);
      }
    } else if (mode === 'senate' || mode === 'vc_pitch') {
      if (otherAssign.side !== mySide) {
        opponents.push(otherId);
      }
    }
  }

  return opponents;
}
