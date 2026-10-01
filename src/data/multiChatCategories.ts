import type { MultiChatCategoryConfig, MultiChatCategoryId } from '@/types';

export const MULTICHAT_CATEGORIES: MultiChatCategoryConfig[] = [
  {
    id: 'general',
    label: 'General',
    iconName: 'Globe',
    badge: '💬 BALANCED',
    description: 'Balanced, multi-angle exploration synthesizing facts, practical advice, and mindful perspective.',
    promptContext: 'Focus on balanced multi-perspective inquiry with clear, grounded takeaways.',
    suggestedQuestions: [
      'How can someone develop multidisciplinary thinking across science and humanities?',
      'What are the core principles for making high-stakes decisions under uncertainty?',
      'How will urbanization and remote work reshape global cities over the next decade?',
      'What mental habits separate world-class problem solvers from average practitioners?',
    ],
  },
  {
    id: 'research',
    label: 'Research',
    iconName: 'Search',
    badge: '🔬 EMPIRICAL',
    description: 'Deep fact-grounded synthesis, peer-reviewed evidence, structured analysis and verified data.',
    promptContext: 'Prioritize empirical evidence, verifiable facts, methodology rigor, and clear evidentiary trade-offs.',
    suggestedQuestions: [
      'What are the latest verified developments in solid-state battery commercialization?',
      'How do mRNA vaccine platforms compare with viral vector mechanisms in long-term efficacy?',
      'What does current peer-reviewed research reveal about dietary fasting and cellular autophagy?',
      'Summarize the primary empirical evidence for and against universal basic income pilots.',
    ],
  },
  {
    id: 'technology',
    label: 'Technology & AI',
    iconName: 'Cpu',
    badge: '🤖 ARCHITECTURE',
    description: 'Software architectures, neural models, distributed systems, quantum computing, and emerging tech.',
    promptContext: 'Examine technical architecture, computational complexity, implementation trade-offs, and engineering feasibility.',
    suggestedQuestions: [
      'How do Mixture-of-Experts (MoE) architectures achieve compute efficiency compared to dense transformers?',
      'What are the engineering trade-offs between monolithic databases and distributed event streams?',
      'How is neuromorphic computing evolving to bypass the von Neumann memory bottleneck?',
      'What are the most viable approaches to AI safety verification in autonomous agent workflows?',
    ],
  },
  {
    id: 'science',
    label: 'Science',
    iconName: 'Atom',
    badge: '⚛️ FUNDAMENTAL',
    description: 'Astrophysics, quantum mechanics, molecular biology, materials science, and physical laws.',
    promptContext: 'Grounded in physical laws, experimental validations, first-principles physics, and biological mechanisms.',
    suggestedQuestions: [
      'What is quantum entanglement and how does it challenge classical locality principles?',
      'How does CRISPR-Cas9 precision gene editing work and what are its current clinical limits?',
      'Why is the cosmic expansion rate (Hubble constant) in tension across measurement methods?',
      'How do extreme extremophiles survive in deep oceanic hydrothermal vents without sunlight?',
    ],
  },
  {
    id: 'strategy',
    label: 'Strategy',
    iconName: 'Target',
    badge: '🎯 TACTICAL',
    description: 'Competitive positioning, mental frameworks, risk management, capital allocation, and tactical roadmaps.',
    promptContext: 'Emphasize strategic frameworks, risk asymmetry, leverage points, and practical execution roadmaps.',
    suggestedQuestions: [
      'How should an early-stage team prioritize speed of execution versus technical debt?',
      'What strategic frameworks best protect high-margin products from aggressive commoditization?',
      'How do top strategists evaluate asymmetric downside risks versus probabilistic payoffs?',
      'What is the optimal framework for pivoting a core product without alienating initial adopters?',
    ],
  },
  {
    id: 'learning',
    label: 'Learning',
    iconName: 'BookOpen',
    badge: '📚 FIRST PRINCIPLES',
    description: 'First-principles breakdowns, mental schemas, Feynman explanations, and accelerated mastery.',
    promptContext: 'Deconstruct complex topics into intuitive first principles, clear mental models, and step-by-step mastery.',
    suggestedQuestions: [
      'Explain Bayesian probability from first principles using an intuitive real-world analogy.',
      'How can I master linear algebra and matrix calculus efficiently for machine learning?',
      'What is the most effective spaced-repetition protocol for retaining complex technical concepts?',
      'Break down how the global financial settlement system (SWIFT/Fedwire) operates step-by-step.',
    ],
  },
  {
    id: 'creative',
    label: 'Creative',
    iconName: 'Sparkles',
    badge: '🎨 DIVERGENT',
    description: 'Divergent thinking, worldbuilding, narrative architectures, metaphor design, and novel concepts.',
    promptContext: 'Explore novel lateral connections, evocative metaphors, imaginative worldbuilding, and divergent concepts.',
    suggestedQuestions: [
      'Design a plausible futuristic governance model for a permanent self-sustaining Mars colony.',
      'Develop three compelling sci-fi premises exploring the ethical dilemmas of digital consciousness.',
      'Brainstorm 5 innovative product concepts bridging biomimicry and consumer electronics.',
      'Write a metaphorical dialogue explaining entropy through the lens of an ancient library.',
    ],
  },
  {
    id: 'philosophy',
    label: 'Philosophy',
    iconName: 'Compass',
    badge: '🌌 EXISTENTIAL',
    description: 'Ethics, consciousness, metaphysics, epistemology, meaning, and the future of humanity.',
    promptContext: 'Reflect deeply on ethical implications, epistemology, existential meaning, and human consciousness.',
    suggestedQuestions: [
      'If artificial intelligences exhibit synthetic subjective experience, what moral duties arise?',
      'How can one apply Stoic and Buddhist detachment to modern high-pressure leadership?',
      'Does determinism in physical laws preclude the subjective reality of free will?',
      'What constitutes a meaningful human purpose in a post-scarcity automated society?',
    ],
  },
];

export function getCategoryById(id: MultiChatCategoryId | string | undefined): MultiChatCategoryConfig {
  const found = MULTICHAT_CATEGORIES.find((c) => c.id === id);
  return found || MULTICHAT_CATEGORIES[0];
}
