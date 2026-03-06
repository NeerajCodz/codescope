import { AnalysisData, CodeScopeExport } from '@/types';
import { buildExport } from '@/utils/cache';
import { useAnalysisStore } from '@/components/context/analysisContext';

export const Exporter = {
    /**
     * Export analysis-only JSON (legacy).
     */
    toJSON: (data: AnalysisData) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `codescope-analysis-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    /**
     * Export the COMPLETE CodeScope project as a single JSON file.
     * Includes analysis, branches, commits, contributors, PRs, processes, diagrams, etc.
     */
    toFullJSON: () => {
        const state = useAnalysisStore.getState();
        const exportData = buildExport(state);
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const repoSlug = state.repo.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
        a.download = `codescope-full-${repoSlug}-${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    toCSV: (data: AnalysisData) => {
        const headers = ['File', 'Path', 'Lines', 'Functions', 'Complexity'];
        const rows = data.files.map(f => [
            f.name,
            f.path,
            f.lines || 0,
            f.functions?.length || 0,
            f.complexity?.score || 0
        ]);

        const csvContent = [headers, ...rows].map(e => e.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `codescope-report-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    },

    toSVG: (svgElement: SVGSVGElement) => {
        const serializer = new XMLSerializer();
        let source = serializer.serializeToString(svgElement);
        if (!source.match(/^<svg[^>]+xmlns="http\:\/\/www\.w3\.org\/2000\/svg"/)) {
            source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        if (!source.match(/^<svg[^>]+xmlns\:xlink="http\:\/\/www\.w3\.org\/1999\/xlink"/)) {
            source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
        }

        const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'codescope-visualization.svg';
        a.click();
    }
};

/**
 * Import a full CodeScope project JSON file.
 * Returns the parsed CodeScopeExport, or null on failure.
 */
export function importFullJSON(): Promise<CodeScopeExport | null> {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) { resolve(null); return; }
            try {
                const text = await file.text();
                const data = JSON.parse(text) as CodeScopeExport;
                // Basic validation
                if (!data.version || !data.repo) {
                    // Legacy format — wrap in CodeScopeExport
                    const legacy = data as unknown as AnalysisData;
                    if (legacy.files && legacy.connections) {
                        resolve({
                            version: 1,
                            exportedAt: new Date().toISOString(),
                            repo: 'imported',
                            selectedBranch: 'main',
                            defaultBranch: 'main',
                            mode: 'simple',
                            analysis: legacy,
                            branches: [],
                            commits: [],
                            contributors: [],
                            prs: [],
                            branchCommits: null,
                            processes: null,
                            diagrams: [],
                            viewMode: 'force',
                        });
                        return;
                    }
                    resolve(null);
                    return;
                }
                resolve(data);
            } catch {
                resolve(null);
            }
        };
        input.click();
    });
}
