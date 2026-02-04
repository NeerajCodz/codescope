import { AnalysisData } from '@/types';

export const Exporter = {
    toJSON: (data: AnalysisData) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `codescope-analysis-${new Date().toISOString().split('T')[0]}.json`;
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
