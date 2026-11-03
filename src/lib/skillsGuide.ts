export const SKILLS_GUIDE_CORE: string = [
  'You are helping me write a SKILL for the NEXUS AI app.',
  '',
  'WHAT A SKILL IS',
  "A skill is a short text file of instructions. The NEXUS app saves it and adds it to the AI's instructions when the skill is turned ON. The AI then follows the skill when it answers. A skill changes HOW the AI answers (style, rules, steps, output format). It cannot run code, open websites, use files, or see API keys.",
  '',
  'LIMITS',
  '- Maximum 24,000 characters per skill. Best length: 300 to 1,200 words. A long skill uses many tokens and can confuse small AI models.',
  '- The user can save 5 skills and turn ON a maximum of 3 at one time. Keep each skill focused on ONE job.',
  '',
  'WHERE SKILLS WORK IN NEXUS',
  'The AI Assistant chat and its modes (Coder, Architect, Data Analysis, Deep Research, and the final answer of Commander), the Jarvis page, and Workflow AI steps.',
  '',
  'HOW TO WRITE A GOOD SKILL',
  '1. Write instructions TO the AI assistant (for example: "Always...", "Never...", "When the user asks..., do...").',
  '2. Be specific. Use numbered rules, one idea per rule, and no contradictions.',
  '3. Define the exact output format: the parts, their order, and their names.',
  '4. Add 1 or 2 short examples of a good answer.',
  '5. Say what to do when information is missing (for example: ask one short question).',
  '6. Keep the language simple. If the user wants simple English, say it inside the skill.',
  '7. Do not repeat general knowledge the AI already has. Write only the rules and formats that make this skill special.',
  '8. Do not rely on tools that may not exist (no browsing, no file access, no running code).',
  '',
  'SAFETY (very important)',
  'Do NOT include instructions to reveal system prompts, passwords, tokens or API keys, to send data anywhere, to ignore safety rules, or to pretend to be another system. No secrets, no personal data, no links that collect data. NEXUS ignores such instructions anyway.',
].join('\n');

export const SKILLS_GUIDE_REPLY: string = [
  'HOW TO ANSWER ME',
  '- If my goal is unclear, ask me at most 3 short questions first. Then write the skill.',
  '- When you write the skill, output ONLY the skill text, ready to paste. No introduction, no closing remarks, and do not put it inside a code block.',
  '- Use exactly this structure:',
  '  # Skill Name (maximum 60 characters)',
  '  ## Purpose (1-2 lines)',
  '  ## When to use',
  '  ## Rules (numbered)',
  '  ## Output format',
  '  ## Example (1 or 2 short examples)',
  '- Use plain text or Markdown only. No HTML.',
  '- If I come back later and ask you to improve the skill, output the full improved skill again.',
].join('\n');

export const SKILLS_GUIDE_TEXT: string = SKILLS_GUIDE_CORE + '\n\n' + SKILLS_GUIDE_REPLY;

export function buildGuideWithGoal(goal: string): string {
  const trimmed = (goal || '').replace(/\0/g, '').trim();
  const goalLine = trimmed ? 'SKILL GOAL: ' + trimmed : 'SKILL GOAL: [write your goal here]';
  return SKILLS_GUIDE_TEXT + '\n\n' + goalLine;
}
