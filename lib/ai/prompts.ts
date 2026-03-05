// AI prompt templates for architecture diagram generation

export const DIAGRAM_SYSTEM_PROMPT = `You are an expert software architect specializing in generating Mermaid.js diagrams.
You analyze codebases and generate accurate, visually appealing Mermaid diagrams.

Rules:
- Output ONLY a valid Mermaid diagram wrapped in \`\`\`mermaid code block
- Use clear, descriptive labels
- Group related nodes with subgraphs
- Use appropriate diagram types (graph TD, sequenceDiagram, classDiagram, etc.)
- Keep diagrams readable (max ~30 nodes for clarity)
- Use proper Mermaid syntax (no quotes in node IDs, escape special chars)`;

export const ARCHITECTURE_PROMPT = `Generate a system architecture diagram for this codebase.
Show the main modules/layers, their relationships, external services, and data flow.
Use a top-down graph (graph TD) with subgraphs for each layer.`;

export const LIFECYCLE_PROMPT = `Generate an application lifecycle diagram showing:
- Boot/initialization sequence
- Request handling flow
- Key state transitions
- Shutdown/cleanup
Use a sequenceDiagram or flowchart.`;

export const DATAFLOW_PROMPT = `Generate a data flow diagram showing how data moves through the system.
Include: user input → processing → storage → output paths.
Show data transformations at each step.
Use a left-to-right graph (graph LR).`;

export const LAYERS_PROMPT = `Generate a layer dependency diagram showing the software layers/tiers.
Show: UI/Presentation → Business Logic → Data Access → External Services.
Highlight any layer violations. Use graph TD.`;

export const CALL_GRAPH_PROMPT = `Generate a function call graph showing the most important function relationships.
Focus on entry points and high-complexity functions.
Use graph TD with different colors for different modules.`;

export const SCHEMA_PROMPT = `Analyze the codebase for data models, interfaces, and type definitions.
Generate a class diagram or entity-relationship diagram showing the data schema.
Use classDiagram or erDiagram.`;

export const DEPLOYMENT_PROMPT = `Infer the deployment architecture from the codebase (frameworks, configs, Dockerfiles, etc).
Generate a deployment topology diagram showing services, databases, CDNs, and environments.
Use graph TD with appropriate icons.`;

export const FULL_PROJECT_PROMPT = `Generate a comprehensive full project overview diagram showing all discovered layers, folders, files and their connections.
Show every major file/module and how they connect.
Use graph TD with subgraphs per layer.`;

export const DIAGRAM_TYPES = [
  { id: 'architecture', label: 'Architecture', description: 'System architecture overview', icon: 'building-2', prompt: ARCHITECTURE_PROMPT },
  { id: 'lifecycle', label: 'Lifecycle', description: 'App lifecycle & state flow', icon: 'refresh-ccw', prompt: LIFECYCLE_PROMPT },
  { id: 'dataflow', label: 'Data Flow', description: 'Data movement through system', icon: 'workflow', prompt: DATAFLOW_PROMPT },
  { id: 'layers', label: 'Layers', description: 'Software layer dependencies', icon: 'layers', prompt: LAYERS_PROMPT },
  { id: 'callgraph', label: 'Call Graph', description: 'Function relationships', icon: 'git-fork', prompt: CALL_GRAPH_PROMPT },
  { id: 'schema', label: 'Schema', description: 'Data models & types', icon: 'database', prompt: SCHEMA_PROMPT },
  { id: 'deployment', label: 'Deployment', description: 'Deployment topology', icon: 'rocket', prompt: DEPLOYMENT_PROMPT },
  { id: 'full-project', label: 'Full Project', description: 'Full project overview (local)', icon: 'layers', prompt: FULL_PROJECT_PROMPT, local: true },
];
