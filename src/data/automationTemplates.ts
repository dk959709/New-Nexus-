import type {
  AutomationTemplate,
  Workflow,
  WorkflowEdge,
  WorkflowNode,
  WorkflowVariable,
} from '@/types';

function workflow(name: string, nodes: WorkflowNode[], edges: WorkflowEdge[]): Workflow {
  return {
    id: `template-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    name,
    nodes,
    edges,
    updatedAt: Date.now(),
  };
}

function linearEdges(count: number): WorkflowEdge[] {
  return Array.from({ length: Math.max(0, count - 1) }, (_, index) => ({
    id: `edge-${index + 1}`,
    from: `node-${index + 1}`,
    to: `node-${index + 2}`,
  }));
}

function inputNode(text: string): WorkflowNode {
  return { id: 'node-1', type: 'input', label: 'Input', x: 60, y: 160, settings: { text } };
}

const companyVariable: WorkflowVariable = {
  key: 'company',
  label: 'Company',
  description: 'Company or product to research',
  example: 'Notion',
  defaultValue: 'Notion',
  required: true,
};

const topicVariable: WorkflowVariable = {
  key: 'topic',
  label: 'Topic',
  description: 'Subject to investigate',
  example: 'solid-state batteries',
  defaultValue: 'solid-state batteries',
  required: true,
};

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'competitor-brief',
    name: 'Competitor Brief',
    description: 'Research a competitor, extract positioning signals, and produce an executive brief.',
    goal: 'Research a competitor and create an evidence-based executive brief.',
    variables: [companyVariable],
    assumptions: ['Uses public search results', 'Prioritizes recent information'],
    workflow: workflow('Competitor Brief', [
      inputNode('{{company}}'),
      { id: 'node-2', type: 'webSearch', label: 'Web Search', x: 340, y: 160, settings: { query: '{{Input.output}} pricing positioning product launch recent news' } },
      { id: 'node-3', type: 'ai', label: 'Competitor Brief', x: 620, y: 160, settings: { role: 'dataAnalyst', prompt: 'Create a concise competitor brief from these sources. Cover positioning, pricing signals, strengths, weaknesses, and open questions. Cite source links where available and clearly separate facts from inference:\n\n{{Web Search.output}}', maxTokens: '2000' } },
    ], linearEdges(3)),
  },
  {
    id: 'literature-digest',
    name: 'Literature Digest',
    description: 'Search academic papers and turn them into a structured evidence digest.',
    goal: 'Find relevant papers and produce a rigorous literature digest.',
    variables: [topicVariable],
    assumptions: ['Requires a configured Scholar API', 'Citations refer to retrieved papers'],
    workflow: workflow('Literature Digest', [
      inputNode('{{topic}}'),
      { id: 'node-2', type: 'scholar', label: 'Scholar', x: 340, y: 160, settings: { query: '{{Input.output}}' } },
      { id: 'node-3', type: 'ai', label: 'Evidence Digest', x: 620, y: 160, settings: { role: 'general', prompt: 'Write a literature digest using only the retrieved papers. State the consensus, disagreements, methods, limitations, and open questions. Use [1], [2] citations:\n\n{{Scholar.output}}', maxTokens: '2200' } },
    ], linearEdges(3)),
  },
  {
    id: 'weather-briefing',
    name: 'Weather Briefing',
    description: 'Get live weather for a city and produce a practical planning briefing.',
    goal: 'Turn live weather data into a useful daily briefing.',
    variables: [{ key: 'city', label: 'City', description: 'City to check', defaultValue: 'London', required: true }],
    assumptions: ['Weather is current at run time', 'Outdoor advice is general guidance'],
    workflow: workflow('Weather Briefing', [
      inputNode('{{city}}'),
      { id: 'node-2', type: 'weather', label: 'Weather', x: 340, y: 160, settings: { city: '{{Input.output}}' } },
      { id: 'node-3', type: 'ai', label: 'Briefing', x: 620, y: 160, settings: { role: 'general', prompt: 'Create a concise weather briefing from this data. Include what to wear, travel cautions, and one practical recommendation:\n\n{{Weather.output}}', maxTokens: '900' } },
    ], linearEdges(3)),
  },
  {
    id: 'concept-image',
    name: 'Concept Image',
    description: 'Expand a rough idea into a detailed prompt and generate a concept image.',
    goal: 'Create a strong image concept from a short idea.',
    variables: [{ key: 'idea', label: 'Idea', description: 'Rough visual concept', defaultValue: 'a floating observatory above the clouds at dusk', required: true }],
    assumptions: ['Image generation uses the configured image provider', 'One image is generated per run'],
    workflow: workflow('Concept Image', [
      inputNode('{{idea}}'),
      { id: 'node-2', type: 'ai', label: 'Image Prompt', x: 340, y: 160, settings: { role: 'general', prompt: 'Write one vivid, production-ready image prompt. Include subject, composition, lighting, palette, lens, and mood. Return only the prompt:\n\n{{Input.output}}', maxTokens: '700' } },
      { id: 'node-3', type: 'image', label: 'Image', x: 620, y: 160, settings: { prompt: '{{Image Prompt.output}}' } },
    ], linearEdges(3)),
  },
  {
    id: 'launch-brief',
    name: 'Product Launch Brief',
    description: 'Research a product category and produce positioning plus a launch brief.',
    goal: 'Build a launch brief for a product using current market signals.',
    variables: [{ key: 'product', label: 'Product', description: 'Product or category to launch', defaultValue: 'an AI meeting assistant', required: true }],
    assumptions: ['Market claims come from public sources', 'The final brief is a recommendation, not a guarantee'],
    workflow: workflow('Product Launch Brief', [
      inputNode('{{product}}'),
      { id: 'node-2', type: 'webSearch', label: 'Web Search', x: 340, y: 160, settings: { query: '{{Input.output}} market competitors customer pain points recent news' } },
      { id: 'node-3', type: 'ai', label: 'Positioning', x: 620, y: 160, settings: { role: 'general', prompt: 'Extract the audience, pain points, alternatives, and one sharp differentiation angle from these sources:\n\n{{Web Search.output}}', maxTokens: '1200' } },
      { id: 'node-4', type: 'ai', label: 'Launch Brief', x: 900, y: 160, settings: { role: 'general', prompt: 'Write a launch brief using the research and positioning. Include audience, promise, proof, messaging pillars, objections, and a 30-day launch checklist.\n\nResearch:\n{{Web Search.output}}\n\nPositioning:\n{{Positioning.output}}', maxTokens: '2400' } },
    ], linearEdges(4)),
  },
  {
    id: 'space-briefing',
    name: 'NASA Space Briefing',
    description: 'Use NASA APOD data and turn it into a short educational briefing.',
    goal: 'Explain the current NASA astronomy picture in accessible language.',
    variables: [{ key: 'focus', label: 'Focus', description: 'Audience or angle', defaultValue: 'curious beginners', required: true }],
    assumptions: ['Uses the current Astronomy Picture of the Day'],
    workflow: workflow('NASA Space Briefing', [
      inputNode('{{focus}}'),
      { id: 'node-2', type: 'nasa', label: 'NASA APOD', x: 340, y: 160, settings: {} },
      { id: 'node-3', type: 'ai', label: 'Space Briefing', x: 620, y: 160, settings: { role: 'general', prompt: 'Explain this NASA image for the requested audience. Cover what it shows, why it matters, and one surprising detail. Use plain language:\n\nAudience: {{Input.output}}\n\nNASA data:\n{{NASA APOD.output}}', maxTokens: '1000' } },
    ], linearEdges(3)),
  },
  {
    id: 'conditional-research',
    name: 'Adaptive Research Brief',
    description: 'Research a topic, then branch to expand or tighten the draft based on length.',
    goal: 'Produce a research brief that adapts its depth to the first draft length.',
    variables: [topicVariable],
    assumptions: ['The branch threshold is a rough length check', 'The yes branch expands; the no branch tightens'],
    workflow: workflow('Adaptive Research Brief', [
      inputNode('{{topic}}'),
      { id: 'node-2', type: 'webSearch', label: 'Web Search', x: 340, y: 160, settings: { query: '{{Input.output}} latest evidence analysis' } },
      { id: 'node-3', type: 'ai', label: 'Draft', x: 620, y: 160, settings: { role: 'general', prompt: 'Write a structured research draft with key findings, evidence, and caveats:\n\n{{Web Search.output}}', maxTokens: '1800' } },
      { id: 'node-4', type: 'if', label: 'Length Check', x: 900, y: 160, settings: { value1: '{{Draft.output}}', operator: 'lengthGreaterThan', value2: '1600' } },
      { id: 'node-5', type: 'ai', label: 'Expand', x: 1160, y: 80, settings: { role: 'general', prompt: 'Expand this draft with implications, counterarguments, and a short action list. Keep it rigorous:\n\n{{Draft.output}}', maxTokens: '2200' } },
      { id: 'node-6', type: 'ai', label: 'Tighten', x: 1160, y: 260, settings: { role: 'general', prompt: 'Tighten this draft into a crisp five-bullet brief plus one recommendation:\n\n{{Draft.output}}', maxTokens: '1200' } },
    ], [
      { id: 'edge-1', from: 'node-1', to: 'node-2' },
      { id: 'edge-2', from: 'node-2', to: 'node-3' },
      { id: 'edge-3', from: 'node-3', to: 'node-4' },
      { id: 'edge-4', from: 'node-4', to: 'node-5', branch: 'yes' },
      { id: 'edge-5', from: 'node-4', to: 'node-6', branch: 'no' },
    ]),
  },
  {
    id: 'document-digest-email',
    name: 'Document Digest to Email',
    description: 'Extract a public PDF or DOCX, summarize it, and email the digest.',
    goal: 'Read a document URL, summarize it, and deliver the summary by email.',
    variables: [
      {
        key: 'documentUrl',
        label: 'Document URL',
        description: 'Public PDF, DOCX, TXT, MD, CSV, JSON, or HTML URL',
        example: 'https://example.com/report.pdf',
        defaultValue: 'https://example.com/report.pdf',
        required: true,
      },
      {
        key: 'email',
        label: 'Recipient',
        description: 'Where to send the digest',
        example: 'you@example.com',
        defaultValue: 'you@example.com',
        required: true,
      },
    ],
    assumptions: [
      'Email requires RESEND_API_KEY and EMAIL_FROM on the server',
      'Documents are limited to 8 MB and 24k extracted characters',
    ],
    workflow: workflow('Document Digest to Email', [
      inputNode('{{documentUrl}}'),
      { id: 'node-2', type: 'document', label: 'Document', x: 340, y: 160, settings: { url: '{{Input.output}}' } },
      { id: 'node-3', type: 'ai', label: 'Digest', x: 620, y: 160, settings: { role: 'general', prompt: 'Summarize this document for a busy reader. Include purpose, key findings, important numbers, and recommended next steps:\n\n{{Document.output}}', maxTokens: '1600' } },
      { id: 'node-4', type: 'email', label: 'Email Digest', x: 900, y: 160, settings: { to: '{{email}}', subject: 'Document digest: {{Input.output}}', body: '{{Digest.output}}' } },
    ], linearEdges(4)),
  },
  {
    id: 'research-alert-webhook',
    name: 'Research Alert to Webhook',
    description: 'Search for recent evidence and POST a compact JSON alert to a public HTTPS webhook.',
    goal: 'Monitor a topic and deliver a concise evidence alert through a webhook.',
    variables: [topicVariable],
    assumptions: [
      'The webhook must be a public HTTPS endpoint',
      'The payload includes only the generated summary, not credentials',
    ],
    workflow: workflow('Research Alert to Webhook', [
      inputNode('{{topic}}'),
      { id: 'node-2', type: 'webSearch', label: 'Web Search', x: 340, y: 160, settings: { query: '{{Input.output}} latest evidence analysis' } },
      { id: 'node-3', type: 'ai', label: 'Alert Summary', x: 620, y: 160, settings: { role: 'general', prompt: 'Write a compact alert with the three most important findings and one caveat. Keep it under 180 words:\n\n{{Web Search.output}}', maxTokens: '700' } },
      { id: 'node-4', type: 'webhook', label: 'Webhook', x: 900, y: 160, settings: { url: 'https://hooks.example.com/nexus-automation', body: '{"topic": "{{Input.output}}", "summary": "{{Alert Summary.output}}"}' } },
    ], linearEdges(4)),
  },
];
