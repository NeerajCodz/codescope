export const COLORS = [
    'hsl(var(--viz-blue))',
    'hsl(var(--viz-purple))',
    'hsl(var(--viz-cyan))',
    'hsl(var(--viz-green))',
    'hsl(var(--viz-orange))',
    'hsl(var(--viz-pink))',
    'hsl(var(--viz-red))',
    'hsl(var(--viz-lime))',
];

export const LAYER_COLORS: Record<string, string> = {
    ui: 'hsl(var(--viz-blue))',
    components: 'hsl(var(--viz-cyan))',
    services: 'hsl(var(--viz-purple))',
    utils: 'hsl(var(--viz-green))',
    data: 'hsl(var(--viz-orange))',
    config: 'hsl(var(--viz-pink))',
};

export const IGNORE = new Set([
    'node_modules',
    '.git',
    'vendor',
    'dist',
    'build',
    '__pycache__',
    '.next',
    'coverage',
    '.turbo',
    'out',
    '.vercel',
]);

export const VIEW_MODES = [
    { id: 'force', name: 'Force Graph', icon: '🌐', description: 'Interactive force-directed graph' },
    { id: 'cluster', name: 'Cluster Graph', icon: '🧩', description: 'Clustered file groups by category' },
    { id: 'treemap', name: 'Treemap', icon: '📦', description: 'Hierarchical space-filling visualization' },
    { id: 'matrix', name: 'Matrix', icon: '⊞', description: 'Dependency matrix heatmap' },
    { id: 'dendrogram', name: 'Dendrogram', icon: '🌳', description: 'Hierarchical tree structure' },
    { id: 'sankey', name: 'Sankey', icon: '〰️', description: 'Flow diagram showing connections' },
    { id: 'bundle', name: 'Bundle', icon: '🎯', description: 'Hierarchical edge bundling' },
    { id: 'arc', name: 'Arc', icon: '🌈', description: 'Arc diagram of dependencies' },
] as const;
