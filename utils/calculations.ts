import { AnalysisData, BlastRadius, Connection, FileNode, HealthScore } from '@/types';

export function calcBlast(
    fileId: string,
    connections: Connection[],
    files: FileNode[]
): BlastRadius {
    const exportedTo: Record<string, Set<string>> = {};
    const importedFrom: Record<string, Set<string>> = {};
    const exportedFns: Record<string, Map<string, number>> = {};

    connections.forEach((c) => {
        const src = c.source;
        const tgt = c.target;

        if (!exportedTo[src]) exportedTo[src] = new Set();
        exportedTo[src].add(tgt);

        if (!importedFrom[tgt]) importedFrom[tgt] = new Set();
        importedFrom[tgt].add(src);

        if (!exportedFns[src]) exportedFns[src] = new Map();
        const fnMap = exportedFns[src];
        fnMap.set(c.fn, (fnMap.get(c.fn) || 0) + (c.count || 1));
    });

    const directDeps = exportedTo[fileId] ? Array.from(exportedTo[fileId]) : [];

    const transitive = new Map<string, number>();
    const queue: Array<{ file: string; depth: number }> = directDeps.map((f) => ({
        file: f,
        depth: 1,
    }));
    const visited = new Set([fileId, ...directDeps]);

    while (queue.length > 0) {
        const item = queue.shift()!;
        if (item.depth > 3) continue;
        transitive.set(item.file, item.depth);
        const nextDeps = exportedTo[item.file] || new Set();
        nextDeps.forEach((f) => {
            if (!visited.has(f)) {
                visited.add(f);
                queue.push({ file: f, depth: item.depth + 1 });
            }
        });
    }

    const fnUsage = exportedFns[fileId] || new Map();
    const fnsUsed = fnUsage.size;
    let totalCalls = 0;
    fnUsage.forEach((cnt) => (totalCalls += cnt));

    const dependencies = importedFrom[fileId] ? Array.from(importedFrom[fileId]) : [];

    let impactScore = directDeps.length;
    transitive.forEach((depth) => {
        if (depth > 1) impactScore += 1 / depth;
    });

    const centrality = directDeps.length + dependencies.length + fnsUsed;

    let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const connectedFiles = files.filter(
        (f) => exportedTo[f.path] || importedFrom[f.path]
    ).length;
    const relativePct = connectedFiles > 0 ? Math.round((directDeps.length / connectedFiles) * 100) : 0;

    if (directDeps.length >= 8 || fnsUsed >= 5) level = 'critical';
    else if (directDeps.length >= 4 || fnsUsed >= 3) level = 'high';
    else if (directDeps.length >= 2 || fnsUsed >= 1) level = 'medium';

    return {
        affected: directDeps,
        transitive: Array.from(transitive.keys()),
        count: directDeps.length,
        transitiveCount: transitive.size,
        percent: relativePct,
        level,
        depth: transitive.size > 0 ? Math.max(...Array.from(transitive.values())) : 0,
        fnsUsed,
        totalCalls,
        dependencies,
        impactScore: Math.round(impactScore * 10) / 10,
        centrality,
    };
}

export function calcHealth(data: AnalysisData | null): HealthScore {
    if (!data) return { score: 0, grade: 'F' };

    let score = 100;

    const deadPct = data.stats.functions > 0 ? (data.stats.dead / data.stats.functions) * 100 : 0;
    score -= Math.min(20, deadPct);

    const circular = data.issues.filter((i) => i.title.includes('Circular')).length;
    score -= Math.min(20, circular * 5);

    const god = data.issues.filter((i) => i.title.includes('Large')).length;
    score -= Math.min(15, god * 3);

    const avgCoup = data.stats.files > 0 ? data.stats.connections / data.stats.files : 0;
    score -= Math.min(15, Math.max(0, avgCoup - 3) * 2);

    const sec = data.securityIssues
        ? data.securityIssues.filter((i) => i.severity === 'high').length
        : 0;
    score -= Math.min(20, sec * 5);

    score = Math.max(0, Math.round(score));

    let grade: 'A' | 'B' | 'C' | 'D' | 'F' = 'F';
    if (score >= 90) grade = 'A';
    else if (score >= 80) grade = 'B';
    else if (score >= 70) grade = 'C';
    else if (score >= 60) grade = 'D';

    return { score, grade };
}

export function formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

export function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 10) / 10 + ' ' + sizes[i];
}

export function getColorForLevel(level: 'low' | 'medium' | 'high' | 'critical'): string {
    switch (level) {
        case 'critical':
            return 'hsl(var(--viz-red))';
        case 'high':
            return 'hsl(var(--viz-orange))';
        case 'medium':
            return 'hsl(var(--viz-blue))';
        case 'low':
            return 'hsl(var(--viz-green))';
    }
}

export function getColorForSeverity(severity: 'low' | 'medium' | 'high'): string {
    switch (severity) {
        case 'high':
            return 'hsl(var(--viz-red))';
        case 'medium':
            return 'hsl(var(--viz-orange))';
        case 'low':
            return 'hsl(var(--viz-blue))';
    }
}
