import {
  Scale,
  Sunrise,
  History,
  Atom,
  MessageCircle,
  Landmark,
  HelpCircle,
  Palette,
  Flag,
  Heart,
  Cpu,
  Globe,
  Shield,
  Lightbulb,
  Rocket,
  Anchor,
  Puzzle,
  Eye,
  Flame,
  GitMerge,
  Bot,
  type LucideIcon,
} from 'lucide-react';

/**
 * Explicit 20-agent icon mapping:
 * VERITAS=Scale, AURORA=Sunrise, CHRONOS=History, AXIOM=Atom, ECHO=MessageCircle,
 * LEDGER=Landmark, SOCRATES=HelpCircle, PIXEL=Palette, VANGUARD=Flag, HARMONY=Heart,
 * CIPHER=Cpu, NOMAD=Globe, SENTINEL=Shield, LUMEN=Lightbulb, CATALYST=Rocket,
 * GRAVITY=Anchor, MOSAIC=Puzzle, ORACLE=Eye, EMBER=Flame, NEXUS-9=GitMerge.
 */
export const PARALLAX_AGENT_ICONS: Record<string, LucideIcon> = {
  veritas: Scale,
  aurora: Sunrise,
  chronos: History,
  axiom: Atom,
  echo: MessageCircle,
  ledger: Landmark,
  socrates: HelpCircle,
  pixel: Palette,
  vanguard: Flag,
  harmony: Heart,
  cipher: Cpu,
  nomad: Globe,
  sentinel: Shield,
  lumen: Lightbulb,
  catalyst: Rocket,
  gravity: Anchor,
  mosaic: Puzzle,
  oracle: Eye,
  ember: Flame,
  nexus9: GitMerge,
};

export function getParallaxAgentIcon(agentIdOrName?: string): LucideIcon {
  if (!agentIdOrName) return Bot;
  const key = agentIdOrName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return PARALLAX_AGENT_ICONS[key] || Bot;
}
