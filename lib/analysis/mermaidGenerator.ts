/**
 * Mermaid Diagram Generator
 *
 * Generates various Mermaid diagram types from analysis data:
 * - Process flow diagrams (TD/LR)
 * - Dependency graphs
 * - Layer architecture diagrams
 * - Sequence diagrams for call chains
 */

import { AnalysisData, ProcessNode, ProcessStep } from '@/types';

// ─── Types ───────────────────────────────────────────────────────────

export type MermaidDirection = 'TD' | 'LR' | 'BT' | 'RL';
export type MermaidTheme = 'dark' | 'default' | 'forest' | 'neutral';

export interface MermaidOptions {
  direction?: MermaidDirection;
  maxNodes?: number;
  showSubgraphs?: boolean;
  showStyles?: boolean;
}

// ─── Process Flow Diagram ────────────────────────────────────────────

export function generateProcessFlow(
  steps: ProcessStep[],
  edges: Array<{ from: string; to: string }>,
  options: MermaidOptions = {},
): string {
  const {
    direction = 'TD',
    maxNodes = 50,
    showSubgraphs = true,
    showStyles = true,
  } = options;

  const truncatedSteps = steps.slice(0, maxNodes);
  const lines: string[] = [`graph ${direction}`];
  const nodeIds = new Map<string, string>();
  let counter = 0;

  // Group by file for subgraphs
  if (showSubgraphs) {
    const fileGroups = new Map<string, ProcessStep[]>();
    for (const step of truncatedSteps) {
      const existing = fileGroups.get(step.file) || [];
      existing.push(step);
      fileGroups.set(step.file, existing);
    }

    if (fileGroups.size > 1) {
      for (const [file, fileSteps] of fileGroups) {
        const shortFile = file.split('/').pop() || file;
        const subId = `sub_${counter++}`;
        lines.push(`    subgraph ${subId}["📄 ${shortFile}"]`);

        for (const step of fileSteps) {
          const safeId = `N${counter++}`;
          nodeIds.set(step.id, safeId);
          lines.push(`        ${safeId}${nodeShape(step)}`);
        }

        lines.push('    end');
      }
    } else {
      for (const step of truncatedSteps) {
        const safeId = `N${counter++}`;
        nodeIds.set(step.id, safeId);
        lines.push(`    ${safeId}${nodeShape(step)}`);
      }
    }
  } else {
    for (const step of truncatedSteps) {
      const safeId = `N${counter++}`;
      nodeIds.set(step.id, safeId);
      lines.push(`    ${safeId}${nodeShape(step)}`);
    }
  }

  // Add edges
  for (const edge of edges) {
    const srcId = nodeIds.get(edge.from);
    const tgtId = nodeIds.get(edge.to);
    if (srcId && tgtId) {
      lines.push(`    ${srcId} --> ${tgtId}`);
    }
  }

  // Style nodes
  if (showStyles) {
    const entryIds = truncatedSteps.filter(s => s.isEntry).map(s => nodeIds.get(s.id)).filter(Boolean);
    const terminalIds = truncatedSteps.filter(s => s.isTerminal).map(s => nodeIds.get(s.id)).filter(Boolean);

    if (entryIds.length) lines.push(`    style ${entryIds.join(',')} fill:#3b82f6,color:#fff,stroke:#2563eb`);
    if (terminalIds.length) lines.push(`    style ${terminalIds.join(',')} fill:#22c55e,color:#fff,stroke:#16a34a`);
  }

  return lines.join('\n');
}

function sanitizeLabel(value: string): string {
  return value
    .replace(/[\r\n]+/g, ' ')
    .replace(/[\[\]{}<>]/g, ' ')
    .replace(/"/g, "'")
    .replace(/\|/g, '/')
    .replace(/\s+/g, ' ')
    .trim();
}

function nodeShape(step: ProcessStep): string {
  const label = sanitizeLabel(step.label) || 'node';
  if (step.isEntry) return `[["${label}"]]`;
  if (step.isTerminal) return `(("${label}"))`;
  return `["${label}"]`;
}

// ─── Dependency Architecture Diagram ─────────────────────────────────

export function generateDependencyGraph(
  data: AnalysisData,
  options: MermaidOptions = {},
): string {
  const { direction = 'LR', maxNodes = 30 } = options;
  const lines: string[] = [`graph ${direction}`];

  // Group files by layer
  const layers = new Map<string, string[]>();
  for (const file of data.files.slice(0, maxNodes)) {
    const layer = file.layer || 'unknown';
    const existing = layers.get(layer) || [];
    existing.push(file.path);
    layers.set(layer, existing);
  }

  let counter = 0;
  const nodeIds = new Map<string, string>();

  const layerColors: Record<string, string> = {
    ui: '#3b82f6',
    service: '#a855f7',
    data: '#22c55e',
    util: '#eab308',
    config: '#6b7280',
  };

  for (const [layer, files] of layers) {
    const subId = `layer_${counter++}`;
    const color = layerColors[layer] || '#6b7280';
    lines.push(`    subgraph ${subId}["${layer.toUpperCase()}"]`);
    lines.push(`    style ${subId} fill:${color}10,stroke:${color}`);

    for (const file of files) {
      const safeId = `F${counter++}`;
      const shortName = file.split('/').pop() || file;
      nodeIds.set(file, safeId);
      lines.push(`        ${safeId}["${shortName}"]`);
    }

    lines.push('    end');
  }

  // Add connection edges
  const seen = new Set<string>();
  for (const conn of data.connections) {
    const srcId = nodeIds.get(conn.source);
    const tgtId = nodeIds.get(conn.target);
    if (srcId && tgtId) {
      const key = `${srcId}->${tgtId}`;
      if (!seen.has(key)) {
        seen.add(key);
        lines.push(`    ${srcId} --> ${tgtId}`);
      }
    }
  }

  return lines.join('\n');
}

// ─── Sequence Diagram for a Process ──────────────────────────────────

export function generateSequenceDiagram(
  process: ProcessNode,
): string {
  const lines: string[] = ['sequenceDiagram'];

  // Extract unique files involved
  const files = [...new Set(process.traceFiles)];
  const shortNames = files.map(f => f.split('/').pop() || f);

  // Add participants
  for (let i = 0; i < files.length; i++) {
    lines.push(`    participant ${sanitizeParticipant(shortNames[i])}`);
  }

  // Build a simplified call sequence from the trace
  for (let i = 0; i < process.trace.length - 1; i++) {
    const current = process.trace[i];
    const next = process.trace[i + 1];

    const currentFile = getFileFromNodeId(current);
    const nextFile = getFileFromNodeId(next);
    const nextName = getNameFromNodeId(next);

    const fromParticipant = sanitizeParticipant(currentFile.split('/').pop() || currentFile);
    const toParticipant = sanitizeParticipant(nextFile.split('/').pop() || nextFile);

    if (fromParticipant === toParticipant) {
      lines.push(`    ${fromParticipant}->>+${fromParticipant}: ${nextName}()`);
    } else {
      lines.push(`    ${fromParticipant}->>+${toParticipant}: ${nextName}()`);
    }

    // Limit to prevent huge diagrams
    if (i > 30) {
      lines.push(`    Note over ${fromParticipant}: ... ${process.trace.length - i - 1} more calls`);
      break;
    }
  }

  return lines.join('\n');
}

function getFileFromNodeId(nodeId: string): string {
  return nodeId.includes('::') ? nodeId.split('::')[0] : nodeId;
}

function getNameFromNodeId(nodeId: string): string {
  return nodeId.includes('::') ? nodeId.split('::')[1] : nodeId.split('/').pop() || nodeId;
}

function sanitizeParticipant(name: string): string {
  // Mermaid participants can't have dots or special chars
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^_+|_+$/g, '');
}

// ─── Mermaid Code Sanitization ───────────────────────────────────────

/**
 * Sanitize mermaid code to prevent common syntax errors.
 * Fixes:
 * - Removes invalid characters in node IDs
 * - Strips empty lines inside diagram blocks
 * - Ensures graph/flowchart declarations exist
 * - Removes markdown code fences if present
 */
export function sanitizeMermaidCode(code: string): string {
  let sanitized = code.trim();

  // Strip markdown code fences
  sanitized = sanitized.replace(/^```(?:mermaid)?\s*\n?/i, '').replace(/\n?```\s*$/i, '');

  // Remove zero-width characters and BOMs
  sanitized = sanitized.replace(/[\u200B\u200C\u200D\uFEFF]/g, '');

  // Normalize statement separators for minified mermaid like: graph TD; A-->B; end;
  sanitized = sanitized.replace(/;/g, '\n');

  // Ensure lines don't have trailing semicolons/spaces
  sanitized = sanitized.replace(/;\s*$/gm, '').replace(/[ \t]+$/gm, '');

  const lines = sanitized
    .split('\n')
    .map((line) => line.replace(/[\u0000-\u001F]/g, '').trimEnd())
    .filter((line, index, all) => line.trim() !== '' || (index > 0 && all[index - 1].trim() !== ''));

  // If header is missing, default to flowchart TD for robustness
  const first = lines.find((line) => line.trim().length > 0) || '';
  const hasHeader = /^(graph|flowchart|sequenceDiagram|classDiagram|erDiagram|stateDiagram|gantt|pie|journey|gitGraph|mindmap|timeline)\b/.test(first.trim());
  if (!hasHeader) {
    lines.unshift('flowchart TD');
  }

  return lines.join('\n').trim();
}

// ─── Mermaid Config ──────────────────────────────────────────────────

/**
 * Full Project Architecture Diagram
 *
 * Shows all layers, key files, and inter-layer connections.
 * Edge-limited to prevent mermaid overflow.
 */
export function generateFullProjectDiagram(
  data: AnalysisData,
  options: MermaidOptions = {},
): string {
  const { direction = 'TD', maxNodes = 80 } = options;
  const lines: string[] = [`graph ${direction}`];

  // Group files by layer, then by folder within each layer
  const layerFolders = new Map<string, Map<string, string[]>>();
  for (const file of data.files.slice(0, maxNodes)) {
    const layer = file.layer || 'unknown';
    const folder = file.folder || 'root';
    if (!layerFolders.has(layer)) layerFolders.set(layer, new Map());
    const folderMap = layerFolders.get(layer)!;
    if (!folderMap.has(folder)) folderMap.set(folder, []);
    folderMap.get(folder)!.push(file.path);
  }

  let counter = 0;
  const nodeIds = new Map<string, string>();

  const layerEmoji: Record<string, string> = {
    ui: '🖥️', service: '⚙️', data: '💾', util: '🔧', config: '📋', unknown: '📦',
  };
  const layerStyle: Record<string, string> = {
    ui: 'fill:#3b82f620,stroke:#3b82f6,color:#93c5fd',
    service: 'fill:#a855f720,stroke:#a855f7,color:#d8b4fe',
    data: 'fill:#22c55e20,stroke:#22c55e,color:#86efac',
    util: 'fill:#eab30820,stroke:#eab308,color:#fde68a',
    config: 'fill:#6b728020,stroke:#6b7280,color:#d1d5db',
    unknown: 'fill:#47556920,stroke:#475569,color:#94a3b8',
  };

  for (const [layer, folders] of layerFolders) {
    const emoji = layerEmoji[layer] || '📦';
    const layerSubId = `layer_${counter++}`;
    lines.push(`    subgraph ${layerSubId}["${emoji} ${layer.toUpperCase()} Layer"]`);

    // If many folders, group them; otherwise flat
    if (folders.size > 1) {
      for (const [folder, files] of folders) {
        const shortFolder = sanitizeLabel(folder.split('/').slice(-2).join('/') || folder) || 'folder';
        const folderSubId = `folder_${counter++}`;
        lines.push(`        subgraph ${folderSubId}["📁 ${shortFolder}"]`);
        for (const filePath of files) {
          const safeId = `P${counter++}`;
          const shortName = sanitizeLabel(filePath.split('/').pop() || filePath) || 'file';
          nodeIds.set(filePath, safeId);
          lines.push(`            ${safeId}["${shortName}"]`);
        }
        lines.push('        end');
      }
    } else {
      for (const [, files] of folders) {
        for (const filePath of files) {
          const safeId = `P${counter++}`;
          const shortName = filePath.split('/').pop() || filePath;
          nodeIds.set(filePath, safeId);
          lines.push(`        ${safeId}["${shortName}"]`);
        }
      }
    }

    lines.push('    end');
    const style = layerStyle[layer] || layerStyle.unknown;
    lines.push(`    style ${layerSubId} ${style}`);
  }

  // Add edges — limit to top connections by count to avoid overflow
  const edgeBuckets = new Map<string, number>();
  for (const conn of data.connections) {
    const srcId = nodeIds.get(conn.source);
    const tgtId = nodeIds.get(conn.target);
    if (srcId && tgtId && srcId !== tgtId) {
      const key = `${srcId}-->${tgtId}`;
      edgeBuckets.set(key, (edgeBuckets.get(key) || 0) + (conn.count || 1));
    }
  }

  // Sort by weight and keep top 200 edges
  const sortedEdges = Array.from(edgeBuckets.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 200);

  for (const [edge] of sortedEdges) {
    lines.push(`    ${edge}`);
  }

  return lines.join('\n');
}

/**
 * Graph tab diagram: architecture graph + issue/security notes.
 */
export function generateSurrealGraphDiagram(
  data: AnalysisData,
  options: MermaidOptions = {},
): string {
  const base = generateFullProjectDiagram(data, options).split('\n');
  const lines = [...base];

  const noteItems = [
    ...(data.issues || []).slice(0, 6).map((issue, index) => ({
      id: `I${index}`,
      text: `${issue.severity.toUpperCase()}: ${sanitizeLabel(issue.title).slice(0, 44)}`,
      path: issue.path || issue.file,
    })),
    ...(data.securityIssues || []).slice(0, 4).map((issue, index) => ({
      id: `S${index}`,
      text: `SEC-${issue.severity.toUpperCase()}: ${sanitizeLabel(issue.title).slice(0, 40)}`,
      path: issue.path || issue.file,
    })),
  ].slice(0, 10);

  if (noteItems.length) {
    lines.push('    subgraph notes_zone["📝 Notes"]');
    for (const note of noteItems) {
      lines.push(`        ${note.id}["${note.text}"]`);
    }
    lines.push('    end');

    const fileNodeMap = new Map<string, string>();
    for (const line of base) {
      const match = line.match(/^\s*(P\d+)\["(.+)"\]$/);
      if (match) {
        fileNodeMap.set(match[2], match[1]);
      }
    }

    noteItems.forEach((note) => {
      const short = sanitizeLabel(note.path?.split('/').pop() || '');
      const target = short ? Array.from(fileNodeMap.entries()).find(([label]) => label === short)?.[1] : undefined;
      if (target) {
        lines.push(`    ${note.id} -.-> ${target}`);
      }
    });

    lines.push('    style notes_zone fill:#f59e0b10,stroke:#f59e0b,color:#fbbf24');
  }

  return lines.join('\n');
}

export function getFallbackMermaidDiagram(title = 'Mermaid Render Fallback'): string {
  const safeTitle = sanitizeLabel(title) || 'Mermaid Render Fallback';
  return [
    'flowchart TD',
    `    A["${safeTitle}"]`,
    '    B["Original diagram had syntax issues"]',
    '    C["Source is still available in the code panel"]',
    '    A --> B --> C',
  ].join('\n');
}

export function getMermaidConfig(theme: MermaidTheme = 'dark') {
  return {
    startOnLoad: false,
    theme,
    maxEdges: 10000,
    themeVariables: theme === 'dark' ? {
      darkMode: true,
      background: '#0f172a',
      primaryColor: '#3b82f6',
      primaryTextColor: '#e2e8f0',
      primaryBorderColor: '#2563eb',
      lineColor: '#64748b',
      secondaryColor: '#1e293b',
      tertiaryColor: '#0f172a',
      fontFamily: 'JetBrains Mono, monospace',
      fontSize: '12px',
    } : undefined,
    securityLevel: 'loose' as const,
    flowchart: { curve: 'basis' as const, padding: 10 },
    sequence: { actorMargin: 50, messageFontSize: 12 },
  };
}
