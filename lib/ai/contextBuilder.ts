// Builds a condensed context string from AnalysisData for AI prompts

import { AnalysisData } from '@/types';

export function buildRepoContext(data: AnalysisData, maxTokens: number = 4000): string {
  const sections: string[] = [];

  // 1. Stats overview
  sections.push(`## Repository Stats
- Files: ${data.stats.files} (${data.stats.codeFiles} code files)
- Functions: ${data.stats.functions} (${data.stats.dead} unused/dead)
- Connections: ${data.stats.connections}
- Avg Complexity: ${data.stats.avgComplexity}
- Total Lines: ${data.totalLines || 'N/A'}
`);

  // 2. Languages
  if (data.languages && Object.keys(data.languages).length > 0) {
    sections.push(`## Languages\n${Object.entries(data.languages).map(([lang, count]) => `- ${lang}: ${count} files`).join('\n')}\n`);
  }

  // 3. File tree (condensed)
  const folders = new Map<string, string[]>();
  data.files.forEach(f => {
    const dir = f.folder || 'root';
    if (!folders.has(dir)) folders.set(dir, []);
    folders.get(dir)!.push(f.name);
  });

  let tree = '## File Structure\n';
  const sortedFolders = Array.from(folders.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  for (const [dir, files] of sortedFolders.slice(0, 30)) {
    tree += `${dir}/\n`;
    files.slice(0, 5).forEach(f => { tree += `  ${f}\n`; });
    if (files.length > 5) tree += `  ... +${files.length - 5} more\n`;
  }
  if (sortedFolders.length > 30) tree += `... +${sortedFolders.length - 30} more directories\n`;
  sections.push(tree);

  // 4. Top functions by calls
  const allFns = data.files.flatMap(f => f.functions || []).filter(fn => fn.totalCalls && fn.totalCalls > 0);
  const topFns = allFns.sort((a, b) => (b.totalCalls || 0) - (a.totalCalls || 0)).slice(0, 15);
  if (topFns.length > 0) {
    sections.push(`## Key Functions (by usage)\n${topFns.map(fn => `- ${fn.name} (${fn.file}, ${fn.totalCalls} calls)`).join('\n')}\n`);
  }

  // 5. Patterns detected
  if (data.patterns.length > 0) {
    sections.push(`## Design Patterns\n${data.patterns.map(p => `- ${p.name}: ${p.files.length} instances - ${p.desc}`).join('\n')}\n`);
  }

  // 6. Security issues summary
  if (data.securityIssues.length > 0) {
    const bySeverity: Record<string, number> = {};
    data.securityIssues.forEach(i => { bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1; });
    sections.push(`## Security Issues\n${Object.entries(bySeverity).map(([sev, count]) => `- ${sev}: ${count}`).join('\n')}\n`);
  }

  // 7. Dependencies (imports)
  const imports = new Set<string>();
  data.connections.filter(c => c.fn === 'import').slice(0, 50).forEach(c => {
    imports.add(`${c.source} → ${c.target}`);
  });
  if (imports.size > 0) {
    sections.push(`## Key Dependencies\n${Array.from(imports).slice(0, 20).join('\n')}\n`);
  }

  // Join and truncate to approximate token limit
  let context = sections.join('\n');
  const approxChars = maxTokens * 4; // ~4 chars per token
  if (context.length > approxChars) {
    context = context.slice(0, approxChars) + '\n... [context truncated]';
  }

  return context;
}

export function buildChatSystemPrompt(repoContext: string): string {
  return `You are CodeScope AI — an intelligent code analysis assistant.
You have deep knowledge of the repository being analyzed. Answer questions about the codebase accurately and concisely.
Use the repository context below to inform your answers. If you're unsure, say so.

${repoContext}

Guidelines:
- Be concise but thorough
- Reference specific files and functions when relevant
- Suggest improvements when appropriate
- Use markdown formatting for code snippets`;
}
